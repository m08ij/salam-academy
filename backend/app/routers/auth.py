"""Sign-in, MFA challenge, sign-out, password reset, invitations and optional self-registration."""
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, update
from sqlalchemy.orm import Session as DB

from .. import audit, mailer
from ..config import get_settings
from ..db import get_db, utcnow
from ..deps import Ctx, current_pending
from ..models import STAFF_ROLES, Token, User
from ..permissions import PERMS
from ..security import mfa, ratelimit, sessions
from ..security.passwords import hash_password, needs_rehash, policy_errors, verify_password
from ..security.tokens import digest, new_token

router = APIRouter(prefix="/api/auth", tags=["auth"])
GENERIC_FAIL = {"code": "invalid_credentials"}
TRIAL_ONLY = {"code": "trial_only"}


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class MfaIn(BaseModel):
    code: str | None = Field(default=None, max_length=12)
    recovery_code: str | None = Field(default=None, max_length=16)


class EmailIn(BaseModel):
    email: EmailStr


class TokenPasswordIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=1, max_length=256)


class SignupIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=1, max_length=256)
    locale: str = Field(default="ar", pattern="^(ar|en)$")


class VerifyIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)


def me_payload(ctx_user: User, mfa_passed: bool) -> dict:
    s = get_settings()
    return {
        "id": str(ctx_user.id), "email": ctx_user.email, "name": ctx_user.name, "locale": ctx_user.locale, "role": ctx_user.role,
        "mfa_enabled": ctx_user.mfa_enabled, "mfa_passed": mfa_passed,
        "mfa_setup_required": s.require_staff_mfa and ctx_user.role in STAFF_ROLES and not ctx_user.mfa_enabled,
        "must_change_password": ctx_user.must_change_password,
        "permissions": sorted(PERMS.get(ctx_user.role, ())),
        "share_reflections": ctx_user.share_reflections, "share_plan": ctx_user.share_plan,
    }


def issue_token(db: DB, user: User, kind: str, lifetime: timedelta) -> str:
    db.execute(update(Token).where(Token.user_id == user.id, Token.kind == kind, Token.used_at.is_(None)).values(used_at=utcnow()))
    raw = new_token()
    db.add(Token(user_id=user.id, kind=kind, token_hash=digest(raw), expires_at=utcnow() + lifetime))
    return raw


def find_token(db: DB, raw: str, kind: str) -> Token:
    tok = db.scalar(select(Token).where(Token.token_hash == digest(raw), Token.kind == kind))
    if not tok or tok.used_at is not None or tok.expires_at <= utcnow():
        raise HTTPException(status_code=400, detail={"code": "invalid_token"})
    return tok


@router.post("/login")
def login(body: LoginIn, request: Request, response: Response, db: DB = Depends(get_db)):
    s = get_settings()
    email = body.email.lower().strip()
    ip = sessions.client_ip(request)
    ratelimit.hit(db, f"login:ip:{ip}", 30, 600)
    ratelimit.hit(db, f"login:email:{email}", 10, 600)
    if not s.trial_allowed(email):
        audit.log(db, "login_trial_blocked", None, request, "user", None, email_hash=digest(email)[:16])
        db.commit()
        raise HTTPException(status_code=403, detail=TRIAL_ONLY)
    user = db.scalar(select(User).where(User.email == email))
    now = utcnow()
    locked = bool(user and user.locked_until and user.locked_until > now)
    usable = user is not None and user.status == "active" and not locked
    ok = verify_password(user.password_hash if usable else None, body.password)
    if not ok:
        if user and user.status == "active" and not locked:
            user.failed_logins += 1
            if user.failed_logins >= s.login_max_failures:
                user.locked_until = now + timedelta(minutes=s.lockout_minutes)
                user.failed_logins = 0
                audit.log(db, "account_locked", user, request, "user", user.id)
        audit.log(db, "login_failed", user if user else None, request, "user", user.id if user else None, email_hash=digest(email)[:16])
        db.commit()
        raise HTTPException(status_code=401, detail=GENERIC_FAIL)
    assert user is not None
    user.failed_logins, user.locked_until, user.last_login_at = 0, None, now
    if needs_rehash(user.password_hash or ""):
        user.password_hash = hash_password(body.password)
    setup_required = s.require_staff_mfa and user.role in STAFF_ROLES and not user.mfa_enabled
    sess = sessions.create(db, user, request, response, mfa_passed=not user.mfa_enabled and not setup_required)
    audit.log(db, "login", user, request, "user", user.id)
    db.commit()
    return {"mfa_required": user.mfa_enabled, "mfa_setup_required": setup_required, "must_change_password": user.must_change_password, "me": me_payload(user, sess.mfa_passed)}


@router.post("/mfa")
def mfa_challenge(body: MfaIn, request: Request, response: Response, ctx: Ctx = Depends(current_pending)):
    db, user = ctx.db, ctx.user
    ratelimit.hit(db, f"mfa:{user.id}", 6, 300)
    if not user.mfa_enabled or not user.mfa_secret_enc:
        raise HTTPException(status_code=400, detail={"code": "mfa_not_enabled"})
    secret = mfa.decrypt(user.mfa_secret_enc)
    ok = bool(body.code and secret and mfa.verify_totp(user, secret, body.code))
    used_recovery = False
    if not ok and body.recovery_code:
        ok = used_recovery = mfa.use_recovery_code(db, user, body.recovery_code)
    if not ok:
        audit.log(db, "mfa_failed", user, request, "user", user.id)
        db.commit()
        raise HTTPException(status_code=401, detail={"code": "invalid_code"})
    ctx.session.mfa_passed = True
    sessions.rotate(db, ctx.session, response)
    audit.log(db, "mfa_passed", user, request, "user", user.id, recovery_code=used_recovery or None)
    db.commit()
    return {"ok": True, "me": me_payload(user, True)}


@router.post("/logout")
def logout(request: Request, response: Response, ctx: Ctx = Depends(current_pending)):
    ctx.session.revoked_at = utcnow()
    audit.log(ctx.db, "logout", ctx.user, request, "user", ctx.user.id)
    ctx.db.commit()
    sessions.clear_cookies(response)
    return {"ok": True}


@router.get("/me")
def me(ctx: Ctx = Depends(current_pending)):
    return me_payload(ctx.user, ctx.session.mfa_passed)


@router.post("/forgot")
def forgot(body: EmailIn, request: Request, db: DB = Depends(get_db)):
    """Always answers the same way, so it cannot be used to discover which e-mails have accounts."""
    s = get_settings()
    email = body.email.lower().strip()
    ratelimit.hit(db, f"forgot:ip:{sessions.client_ip(request)}", 10, 3600)
    try:
        ratelimit.hit(db, f"forgot:email:{email}", 3, 3600)
    except HTTPException:
        return {"ok": True}
    user = db.scalar(select(User).where(User.email == email))
    if user and user.status == "active" and s.trial_allowed(email):
        raw = issue_token(db, user, "reset", timedelta(minutes=s.reset_token_minutes))
        audit.log(db, "password_reset_requested", user, request, "user", user.id)
        db.commit()
        mailer.send(user.email, "reset", link=f"{s.app_url}/reset?token={raw}", minutes=s.reset_token_minutes)
    return {"ok": True}


def _set_password(db: DB, user: User, password: str) -> None:
    errs = policy_errors(password, user.email, user.name)
    if errs:
        raise HTTPException(status_code=422, detail={"code": "weak_password", "errors": errs})
    user.password_hash = hash_password(password)
    user.password_changed_at = utcnow()
    user.must_change_password = False
    user.failed_logins, user.locked_until = 0, None


@router.post("/reset")
def reset(body: TokenPasswordIn, request: Request, db: DB = Depends(get_db)):
    ratelimit.hit(db, f"reset:ip:{sessions.client_ip(request)}", 20, 3600)
    tok = find_token(db, body.token, "reset")
    user = db.get(User, tok.user_id)
    if not user or user.status != "active":
        raise HTTPException(status_code=400, detail={"code": "invalid_token"})
    if not get_settings().trial_allowed(user.email):
        raise HTTPException(status_code=403, detail=TRIAL_ONLY)
    _set_password(db, user, body.password)  # a rejected password does not burn the link
    tok.used_at = utcnow()
    sessions.revoke_all(db, user.id)
    audit.log(db, "password_reset", user, request, "user", user.id)
    db.commit()
    mailer.send(user.email, "password_changed")
    return {"ok": True}


@router.post("/accept-invite")
def accept_invite(body: TokenPasswordIn, request: Request, db: DB = Depends(get_db)):
    ratelimit.hit(db, f"invite:ip:{sessions.client_ip(request)}", 20, 3600)
    tok = find_token(db, body.token, "invite")
    user = db.get(User, tok.user_id)
    if not user or user.status != "invited":
        raise HTTPException(status_code=400, detail={"code": "invalid_token"})
    if not get_settings().trial_allowed(user.email):
        raise HTTPException(status_code=403, detail=TRIAL_ONLY)
    _set_password(db, user, body.password)
    tok.used_at = utcnow()
    user.status, user.email_verified_at = "active", utcnow()
    audit.log(db, "invite_accepted", user, request, "user", user.id)
    db.commit()
    return {"ok": True}


@router.post("/signup")
def signup(body: SignupIn, request: Request, db: DB = Depends(get_db)):
    s = get_settings()
    if not s.allow_signup:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    ratelimit.hit(db, f"signup:ip:{sessions.client_ip(request)}", 5, 3600)
    email = body.email.lower().strip()
    if not s.trial_allowed(email):
        raise HTTPException(status_code=403, detail=TRIAL_ONLY)
    errs = policy_errors(body.password, email, body.name)
    if errs:
        raise HTTPException(status_code=422, detail={"code": "weak_password", "errors": errs})
    if db.scalar(select(User).where(User.email == email)):
        return {"ok": True}  # same answer as success: no account enumeration
    user = User(email=email, name=body.name.strip(), locale=body.locale, role="trainee", status="pending", password_hash=hash_password(body.password), password_changed_at=utcnow())
    db.add(user)
    db.flush()
    raw = issue_token(db, user, "verify", timedelta(hours=s.verify_token_hours))
    audit.log(db, "signup", user, request, "user", user.id)
    db.commit()
    mailer.send(user.email, "verify", link=f"{s.app_url}/verify?token={raw}")
    return {"ok": True}


@router.post("/verify")
def verify(body: VerifyIn, request: Request, db: DB = Depends(get_db)):
    tok = find_token(db, body.token, "verify")
    tok.used_at = utcnow()
    user = db.get(User, tok.user_id)
    if not user or user.status != "pending":
        raise HTTPException(status_code=400, detail={"code": "invalid_token"})
    user.status, user.email_verified_at = "active", utcnow()
    audit.log(db, "email_verified", user, request, "user", user.id)
    db.commit()
    return {"ok": True}
