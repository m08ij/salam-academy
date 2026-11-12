"""Self-service account security and privacy: password, two-step verification, sessions, data export and erasure."""
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import delete, select

from .. import audit, mailer
from ..config import get_settings
from ..db import utcnow
from ..deps import Ctx, current, current_pending
from ..models import STAFF_ROLES, Enrollment, Evaluation, GrowthPlan, LessonProgress, ProjectSubmission, Promotion, QuizAttempt, RecoveryCode, Reflection, Session
from ..security import mfa, ratelimit, sessions
from ..security.passwords import hash_password, policy_errors, verify_password
from ..util import parse_id
from .auth import me_payload

router = APIRouter(prefix="/api/me", tags=["account"])


class ProfileIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    locale: str | None = Field(default=None, pattern="^(ar|en)$")


class PasswordIn(BaseModel):
    current: str = Field(min_length=1, max_length=256)
    new: str = Field(min_length=1, max_length=256)


class CodeIn(BaseModel):
    code: str = Field(min_length=6, max_length=12)


class ConfirmPasswordIn(BaseModel):
    password: str = Field(min_length=1, max_length=256)
    code: str | None = Field(default=None, max_length=12)


class PrivacyIn(BaseModel):
    share_reflections: bool
    share_plan: bool


class PlanIn(BaseModel):
    obs: str = Field(default="", max_length=4000)
    ideal: str = Field(default="", max_length=4000)
    review_date: str = Field(default="", max_length=10)
    follow: str = Field(default="", max_length=4000)
    items: list[dict] = Field(default_factory=list, max_length=200)


@router.get("")
def get_me(ctx: Ctx = Depends(current_pending)):
    return me_payload(ctx.user, ctx.session.mfa_passed)


@router.patch("")
def patch_me(body: ProfileIn, ctx: Ctx = Depends(current)):
    if body.name:
        ctx.user.name = body.name.strip()
    if body.locale:
        ctx.user.locale = body.locale
    ctx.db.commit()
    return me_payload(ctx.user, True)


@router.post("/password")
def change_password(body: PasswordIn, request: Request, response: Response, ctx: Ctx = Depends(current_pending)):
    db, user = ctx.db, ctx.user
    if not ctx.session.mfa_passed and user.mfa_enabled:
        raise HTTPException(status_code=401, detail={"code": "mfa_required"})
    ratelimit.hit(db, f"pwchange:{user.id}", 5, 900)
    if not verify_password(user.password_hash, body.current):
        audit.log(db, "password_change_failed", user, request, "user", user.id)
        db.commit()
        raise HTTPException(status_code=401, detail={"code": "invalid_credentials"})
    errs = policy_errors(body.new, user.email, user.name)
    if body.new == body.current:
        errs.append("same_as_current")
    if errs:
        raise HTTPException(status_code=422, detail={"code": "weak_password", "errors": errs})
    user.password_hash, user.password_changed_at, user.must_change_password = hash_password(body.new), utcnow(), False
    n = sessions.revoke_all(db, user.id, except_id=ctx.session.id)
    sessions.rotate(db, ctx.session, response)
    audit.log(db, "password_changed", user, request, "user", user.id, other_sessions_revoked=n)
    db.commit()
    mailer.send(user.email, "password_changed")
    return {"ok": True, "other_sessions_revoked": n}


@router.post("/mfa/setup")
def mfa_setup(ctx: Ctx = Depends(current_pending)):
    user = ctx.user
    if user.mfa_enabled:
        raise HTTPException(status_code=409, detail={"code": "mfa_already_enabled"})
    secret = mfa.new_secret()
    user.mfa_pending_enc = mfa.encrypt(secret)
    ctx.db.commit()
    return {"secret": secret, "otpauth_uri": mfa.provisioning_uri(secret, user.email)}


@router.post("/mfa/confirm")
def mfa_confirm(body: CodeIn, request: Request, response: Response, ctx: Ctx = Depends(current_pending)):
    db, user = ctx.db, ctx.user
    ratelimit.hit(db, f"mfaconf:{user.id}", 6, 300)
    secret = mfa.decrypt(user.mfa_pending_enc) if user.mfa_pending_enc else None
    if not secret or not mfa.verify_totp(user, secret, body.code):
        raise HTTPException(status_code=400, detail={"code": "invalid_code"})
    user.mfa_secret_enc, user.mfa_pending_enc, user.mfa_enabled = user.mfa_pending_enc, None, True
    codes = mfa.new_recovery_codes(db, user)
    ctx.session.mfa_passed = True
    sessions.revoke_all(db, user.id, except_id=ctx.session.id)
    sessions.rotate(db, ctx.session, response)
    audit.log(db, "mfa_enabled", user, request, "user", user.id)
    db.commit()
    mailer.send(user.email, "mfa_changed", state="enabled / مفعّل")
    return {"recovery_codes": codes, "me": me_payload(user, True)}


@router.post("/mfa/disable")
def mfa_disable(body: ConfirmPasswordIn, request: Request, ctx: Ctx = Depends(current)):
    db, user = ctx.db, ctx.user
    if get_settings().require_staff_mfa and user.role in STAFF_ROLES:
        raise HTTPException(status_code=403, detail={"code": "mfa_required_for_role"})
    secret = mfa.decrypt(user.mfa_secret_enc or "")
    if not verify_password(user.password_hash, body.password) or not (secret and body.code and mfa.verify_totp(user, secret, body.code)):
        raise HTTPException(status_code=401, detail={"code": "invalid_credentials"})
    user.mfa_enabled, user.mfa_secret_enc = False, None
    db.execute(delete(RecoveryCode).where(RecoveryCode.user_id == user.id))
    audit.log(db, "mfa_disabled", user, request, "user", user.id)
    db.commit()
    mailer.send(user.email, "mfa_changed", state="disabled / معطّل")
    return {"ok": True}


@router.post("/mfa/recovery-codes")
def regenerate_codes(body: ConfirmPasswordIn, request: Request, ctx: Ctx = Depends(current)):
    if not ctx.user.mfa_enabled:
        raise HTTPException(status_code=400, detail={"code": "mfa_not_enabled"})
    if not verify_password(ctx.user.password_hash, body.password):
        raise HTTPException(status_code=401, detail={"code": "invalid_credentials"})
    codes = mfa.new_recovery_codes(ctx.db, ctx.user)
    audit.log(ctx.db, "recovery_codes_regenerated", ctx.user, request, "user", ctx.user.id)
    ctx.db.commit()
    return {"recovery_codes": codes}


@router.get("/sessions")
def list_sessions(ctx: Ctx = Depends(current)):
    rows = ctx.db.scalars(select(Session).where(Session.user_id == ctx.user.id, Session.revoked_at.is_(None), Session.expires_at > utcnow()).order_by(Session.last_seen_at.desc()))
    return [{"id": str(s.id), "current": s.id == ctx.session.id, "created_at": s.created_at.isoformat(), "last_seen_at": s.last_seen_at.isoformat(), "ip": s.ip, "user_agent": s.user_agent} for s in rows]


@router.delete("/sessions/{sid}")
def revoke_session(sid: str, request: Request, ctx: Ctx = Depends(current)):
    s = ctx.db.get(Session, parse_id(sid))
    if not s or s.user_id != ctx.user.id:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    s.revoked_at = utcnow()
    audit.log(ctx.db, "session_revoked", ctx.user, request, "session", s.id)
    ctx.db.commit()
    return {"ok": True}


@router.post("/sessions/revoke-others")
def revoke_others(request: Request, ctx: Ctx = Depends(current)):
    n = sessions.revoke_all(ctx.db, ctx.user.id, except_id=ctx.session.id)
    audit.log(ctx.db, "sessions_revoked", ctx.user, request, "user", ctx.user.id, count=n)
    ctx.db.commit()
    return {"revoked": n}


@router.get("/privacy")
def get_privacy(ctx: Ctx = Depends(current)):
    return {"share_reflections": ctx.user.share_reflections, "share_plan": ctx.user.share_plan}


@router.put("/privacy")
def put_privacy(body: PrivacyIn, request: Request, ctx: Ctx = Depends(current)):
    ctx.user.share_reflections, ctx.user.share_plan = body.share_reflections, body.share_plan
    audit.log(ctx.db, "privacy_changed", ctx.user, request, "user", ctx.user.id, share_reflections=body.share_reflections, share_plan=body.share_plan)
    ctx.db.commit()
    return {"ok": True}


@router.get("/plan")
def get_plan(ctx: Ctx = Depends(current)):
    p = ctx.db.get(GrowthPlan, ctx.user.id)
    return p.data if p else {"obs": "", "ideal": "", "review_date": "", "follow": "", "items": []}


@router.put("/plan")
def put_plan(body: PlanIn, ctx: Ctx = Depends(current)):
    items = [{"behavior_id": int(i.get("behavior_id")), "note": str(i.get("note", ""))[:1000]} for i in body.items if str(i.get("behavior_id", "")).isdigit()]
    data = body.model_dump() | {"items": items}
    p = ctx.db.get(GrowthPlan, ctx.user.id)
    if p:
        p.data = data
    else:
        ctx.db.add(GrowthPlan(user_id=ctx.user.id, data=data))
    ctx.db.commit()
    return {"ok": True}


@router.get("/export")
def export_my_data(request: Request, ctx: Ctx = Depends(current)):
    db, u = ctx.db, ctx.user
    ens = db.scalars(select(Enrollment).where(Enrollment.user_id == u.id)).all()
    eids = [e.id for e in ens]
    out = {
        "profile": {"email": u.email, "name": u.name, "locale": u.locale, "role": u.role, "created_at": u.created_at.isoformat(), "mfa_enabled": u.mfa_enabled},
        "privacy": {"share_reflections": u.share_reflections, "share_plan": u.share_plan},
        "enrollments": [{"program": e.program.title_ar, "level": e.level_position, "graduated_at": e.graduated_at.isoformat() if e.graduated_at else None} for e in ens],
        "lessons_completed": [{"lesson_id": str(p.lesson_id), "at": p.completed_at.isoformat()} for p in db.scalars(select(LessonProgress).where(LessonProgress.user_id == u.id))],
        "quiz_attempts": [{"lesson_id": str(a.lesson_id), "score": a.score, "total": a.total, "at": a.created_at.isoformat()} for a in db.scalars(select(QuizAttempt).where(QuizAttempt.user_id == u.id))],
        "reflections": [{"lesson_id": str(r.lesson_id), "text": r.text} for r in db.scalars(select(Reflection).where(Reflection.user_id == u.id))],
        "growth_plan": (db.get(GrowthPlan, u.id).data if db.get(GrowthPlan, u.id) else None),
        "projects": [{"level": s.level_position, "title": s.title, "summary": s.summary, "link": s.link, "version": s.version} for s in db.scalars(select(ProjectSubmission).where(ProjectSubmission.enrollment_id.in_(eids)))] if eids else [],
        "evaluations": [{"level": e.level_position, "avg": e.avg, "note": e.note} for e in db.scalars(select(Evaluation).where(Evaluation.enrollment_id.in_(eids)))] if eids else [],
        "promotions": [{"from": p.from_level, "to": p.to_level, "final": p.final} for p in db.scalars(select(Promotion).where(Promotion.enrollment_id.in_(eids)))] if eids else [],
    }
    audit.log(db, "data_exported", u, request, "user", u.id)
    db.commit()
    return out


@router.post("/delete")
def delete_me(body: ConfirmPasswordIn, request: Request, response: Response, ctx: Ctx = Depends(current)):
    """Erases personal content and anonymises the account. Training decisions stay as anonymous records."""
    db, u = ctx.db, ctx.user
    if u.role == "owner":
        raise HTTPException(status_code=409, detail={"code": "owner_cannot_delete"})
    if not verify_password(u.password_hash, body.password):
        raise HTTPException(status_code=401, detail={"code": "invalid_credentials"})
    for model in (Reflection, GrowthPlan, LessonProgress, QuizAttempt):
        db.execute(delete(model).where(model.user_id == u.id))
    eids = [e.id for e in db.scalars(select(Enrollment).where(Enrollment.user_id == u.id))]
    if eids:
        for sub in db.scalars(select(ProjectSubmission).where(ProjectSubmission.enrollment_id.in_(eids))):
            sub.title, sub.summary, sub.link = "—", "—", ""
    db.execute(delete(RecoveryCode).where(RecoveryCode.user_id == u.id))
    sessions.revoke_all(db, u.id)
    audit.log(db, "account_deleted", u, request, "user", u.id)
    u.email, u.name, u.status = f"deleted-{u.id}@invalid", "—", "deleted"
    u.password_hash, u.mfa_enabled, u.mfa_secret_enc, u.mfa_pending_enc = None, False, None, None
    db.commit()
    sessions.clear_cookies(response)
    return {"ok": True}
