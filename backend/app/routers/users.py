"""User administration: invitations, roles, suspension, forced password reset and MFA reset."""
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import delete, select

from .. import audit, mailer
from ..config import get_settings
from ..deps import Ctx, require
from ..models import RecoveryCode, User
from ..permissions import ASSIGNABLE
from ..security import sessions
from ..util import parse_id
from .auth import issue_token

router = APIRouter(prefix="/api/admin/users", tags=["users"])
ROLE_LABEL = {"admin": "مسؤول المنصة / Platform admin", "developer": "مطوّر المنصة / Developer", "trainer": "مدرب / Trainer", "trainee": "متدرب / Trainee"}


class InviteIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=120)
    role: str = Field(pattern="^(admin|developer|trainer|trainee)$")
    locale: str = Field(default="ar", pattern="^(ar|en)$")


class PatchIn(BaseModel):
    role: str | None = Field(default=None, pattern="^(admin|developer|trainer|trainee)$")
    status: str | None = Field(default=None, pattern="^(active|suspended)$")
    name: str | None = Field(default=None, min_length=2, max_length=120)


def _out(u: User) -> dict:
    return {"id": str(u.id), "email": u.email, "name": u.name, "role": u.role, "status": u.status, "mfa_enabled": u.mfa_enabled,
            "locked": bool(u.locked_until), "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None, "created_at": u.created_at.isoformat()}


def _target(ctx: Ctx, uid: str) -> User:
    u = ctx.db.get(User, parse_id(uid))
    if not u or u.status == "deleted":
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    if u.id == ctx.user.id:
        raise HTTPException(status_code=403, detail={"code": "cannot_modify_self"})
    if u.role == "owner":
        raise HTTPException(status_code=403, detail={"code": "cannot_modify_owner"})
    if u.role == "admin" and not ctx.can("grant_admin"):
        raise HTTPException(status_code=403, detail={"code": "admin_requires_owner"})
    return u


@router.get("")
def list_users(ctx: Ctx = Depends(require("users", "roles"))):
    return [_out(u) for u in ctx.db.scalars(select(User).where(User.status != "deleted").order_by(User.created_at))]


@router.post("/invite")
def invite(body: InviteIn, request: Request, ctx: Ctx = Depends(require("users"))):
    s = get_settings()
    if body.role not in ASSIGNABLE.get(ctx.user.role, ()):
        raise HTTPException(status_code=403, detail={"code": "role_not_assignable"})
    email = body.email.lower().strip()
    if not s.trial_allowed(email):
        raise HTTPException(status_code=403, detail={"code": "trial_only"})
    if ctx.db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail={"code": "email_exists"})
    u = User(email=email, name=body.name.strip(), role=body.role, locale=body.locale, status="invited")
    ctx.db.add(u)
    ctx.db.flush()
    raw = issue_token(ctx.db, u, "invite", timedelta(hours=s.invite_token_hours))
    audit.log(ctx.db, "user_invited", ctx.user, request, "user", u.id, role=body.role)
    ctx.db.commit()
    link = f"{s.app_url}/accept-invite?token={raw}"
    mailer.send(u.email, "invite", name=u.name, role=ROLE_LABEL[u.role], link=link, hours=s.invite_token_hours)
    out = _out(u)
    if s.share_invite_links:
        out["invite_link"] = link  # development, or a trial without e-mail (SALAM_SHOW_INVITE_LINKS)
    return out


@router.post("/{uid}/resend-invite")
def resend(uid: str, request: Request, ctx: Ctx = Depends(require("users"))):
    s = get_settings()
    u = _target(ctx, uid)
    if u.status != "invited":
        raise HTTPException(status_code=409, detail={"code": "not_invited"})
    raw = issue_token(ctx.db, u, "invite", timedelta(hours=s.invite_token_hours))
    audit.log(ctx.db, "invite_resent", ctx.user, request, "user", u.id)
    ctx.db.commit()
    link = f"{s.app_url}/accept-invite?token={raw}"
    mailer.send(u.email, "invite", name=u.name, role=ROLE_LABEL.get(u.role, u.role), link=link, hours=s.invite_token_hours)
    return {"ok": True, "invite_link": link} if s.share_invite_links else {"ok": True}


@router.patch("/{uid}")
def patch_user(uid: str, body: PatchIn, request: Request, ctx: Ctx = Depends(require("users", "roles"))):
    u = _target(ctx, uid)
    if body.role and body.role != u.role:
        if not ctx.can("roles") or body.role not in ASSIGNABLE.get(ctx.user.role, ()):
            raise HTTPException(status_code=403, detail={"code": "role_not_assignable"})
        audit.log(ctx.db, "role_changed", ctx.user, request, "user", u.id, old=u.role, new=body.role)
        u.role = body.role
        sessions.revoke_all(ctx.db, u.id)  # new privileges take effect on a fresh sign-in
    if body.status and body.status != u.status:
        if u.status not in ("active", "suspended"):
            raise HTTPException(status_code=409, detail={"code": "invalid_status"})
        u.status = body.status
        if body.status == "suspended":
            sessions.revoke_all(ctx.db, u.id)
        audit.log(ctx.db, "user_" + body.status, ctx.user, request, "user", u.id)
    if body.name:
        u.name = body.name.strip()
    ctx.db.commit()
    return _out(u)


@router.post("/{uid}/force-reset")
def force_reset(uid: str, request: Request, ctx: Ctx = Depends(require("users"))):
    s = get_settings()
    u = _target(ctx, uid)
    u.must_change_password = True
    sessions.revoke_all(ctx.db, u.id)
    raw = issue_token(ctx.db, u, "reset", timedelta(minutes=s.reset_token_minutes))
    audit.log(ctx.db, "password_reset_forced", ctx.user, request, "user", u.id)
    ctx.db.commit()
    mailer.send(u.email, "reset", link=f"{s.app_url}/reset?token={raw}", minutes=s.reset_token_minutes)
    return {"ok": True}


@router.post("/{uid}/reset-mfa")
def reset_mfa(uid: str, request: Request, ctx: Ctx = Depends(require("roles"))):
    u = _target(ctx, uid)
    u.mfa_enabled, u.mfa_secret_enc, u.mfa_pending_enc = False, None, None
    ctx.db.execute(delete(RecoveryCode).where(RecoveryCode.user_id == u.id))
    sessions.revoke_all(ctx.db, u.id)
    audit.log(ctx.db, "mfa_reset_by_admin", ctx.user, request, "user", u.id)
    ctx.db.commit()
    mailer.send(u.email, "mfa_changed", state="reset by admin / أُعيد ضبطه من المسؤول")
    return {"ok": True}


@router.post("/{uid}/unlock")
def unlock(uid: str, request: Request, ctx: Ctx = Depends(require("users"))):
    u = _target(ctx, uid)
    u.locked_until, u.failed_logins = None, 0
    audit.log(ctx.db, "user_unlocked", ctx.user, request, "user", u.id)
    ctx.db.commit()
    return {"ok": True}
