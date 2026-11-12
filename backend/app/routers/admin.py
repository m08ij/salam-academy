"""Administration: enrollments & trainer assignment, cohorts, announcements, audit log, exports and platform settings."""
import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from pydantic import BaseModel, Field
from sqlalchemy import select

from .. import audit
from ..deps import Ctx, current, require
from ..models import STAFF_ROLES, Announcement, AuditLog, Cohort, Enrollment, Program, Promotion, User
from ..services.progress import level_stats, public
from ..util import DEFAULT_GRADES, get_setting, parse_id, put_setting, rubric

router = APIRouter(prefix="/api", tags=["admin"])


class EnrollmentIn(BaseModel):
    user_id: str
    program_id: str
    trainer_id: str | None = None
    cohort_id: str | None = None


class EnrollmentPatch(BaseModel):
    trainer_id: str | None = None
    cohort_id: str | None = None


class CohortIn(BaseModel):
    program_id: str
    name: str = Field(min_length=2, max_length=120)
    starts_on: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    ends_on: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    mode: str = Field(default="online", pattern="^(online|onsite|blended)$")
    place: str = Field(default="", max_length=200)
    capacity: int = Field(default=30, ge=1, le=10000)


class AnnouncementIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    body: str = Field(default="", max_length=4000)


class SettingsIn(BaseModel):
    rubric: list[list[str]] = Field(min_length=2, max_length=8)
    grades: list[dict] = Field(min_length=2, max_length=8)


def _trainer(ctx: Ctx, tid: str | None) -> User | None:
    if not tid:
        return None
    t = ctx.db.get(User, parse_id(tid))
    if not t or t.status != "active" or t.role not in ("owner", "admin", "trainer"):
        raise HTTPException(status_code=422, detail={"code": "invalid_trainer"})
    return t


def _en_out(db, en: Enrollment) -> dict:
    return {"id": str(en.id), "user": {"id": str(en.user_id), "name": en.user.name, "email": en.user.email, "status": en.user.status},
            "program": {"id": str(en.program_id), "title_ar": en.program.title_ar, "title_en": en.program.title_en},
            "trainer": {"id": str(en.trainer_id), "name": en.trainer.name} if en.trainer else None, "cohort_id": str(en.cohort_id) if en.cohort_id else None,
            "level": en.level_position, "levels": len(en.program.levels), "graduated": en.graduated_at is not None}


# ---------- enrollments ----------
@router.get("/admin/enrollments")
def list_enrollments(ctx: Ctx = Depends(require("users"))):
    return [_en_out(ctx.db, e) for e in ctx.db.scalars(select(Enrollment).order_by(Enrollment.created_at)) if e.user.status != "deleted"]


@router.post("/admin/enrollments")
def create_enrollment(body: EnrollmentIn, request: Request, ctx: Ctx = Depends(require("users"))):
    u = ctx.db.get(User, parse_id(body.user_id))
    p = ctx.db.get(Program, parse_id(body.program_id))
    if not u or u.status in ("deleted",) or u.role != "trainee" or not p:
        raise HTTPException(status_code=422, detail={"code": "invalid_enrollment"})
    if ctx.db.scalar(select(Enrollment).where(Enrollment.user_id == u.id, Enrollment.program_id == p.id)):
        raise HTTPException(status_code=409, detail={"code": "already_enrolled"})
    t = _trainer(ctx, body.trainer_id)
    en = Enrollment(user_id=u.id, program_id=p.id, trainer_id=t.id if t else None, cohort_id=parse_id(body.cohort_id) if body.cohort_id else None)
    ctx.db.add(en)
    ctx.db.flush()
    audit.log(ctx.db, "enrollment_created", ctx.user, request, "enrollment", en.id, user=str(u.id), program=p.slug, trainer=str(t.id) if t else None)
    ctx.db.commit()
    return _en_out(ctx.db, en)


@router.patch("/admin/enrollments/{eid}")
def patch_enrollment(eid: str, body: EnrollmentPatch, request: Request, ctx: Ctx = Depends(require("users"))):
    en = ctx.db.get(Enrollment, parse_id(eid))
    if not en:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    fields = body.model_fields_set
    if "trainer_id" in fields:
        t = _trainer(ctx, body.trainer_id)
        en.trainer_id = t.id if t else None
    if "cohort_id" in fields:
        en.cohort_id = parse_id(body.cohort_id) if body.cohort_id else None
    audit.log(ctx.db, "enrollment_updated", ctx.user, request, "enrollment", en.id, trainer=str(en.trainer_id) if en.trainer_id else None, cohort=str(en.cohort_id) if en.cohort_id else None)
    ctx.db.commit()
    return _en_out(ctx.db, en)


@router.get("/admin/trainers")
def list_trainers(ctx: Ctx = Depends(require("users"))):
    return [{"id": str(u.id), "name": u.name, "role": u.role} for u in ctx.db.scalars(select(User).where(User.role.in_(("owner", "admin", "trainer")), User.status == "active"))]


# ---------- cohorts ----------
@router.get("/cohorts")
def list_cohorts(ctx: Ctx = Depends(require("cohorts", "cohorts_read", "users"))):
    return [{"id": str(c.id), "program_id": str(c.program_id), "name": c.name, "starts_on": c.starts_on, "ends_on": c.ends_on, "mode": c.mode, "place": c.place, "capacity": c.capacity}
            for c in ctx.db.scalars(select(Cohort).order_by(Cohort.starts_on))]


@router.post("/cohorts")
def create_cohort(body: CohortIn, request: Request, ctx: Ctx = Depends(require("cohorts"))):
    if not ctx.db.get(Program, parse_id(body.program_id)):
        raise HTTPException(status_code=422, detail={"code": "invalid_program"})
    c = Cohort(**(body.model_dump() | {"program_id": parse_id(body.program_id)}))
    ctx.db.add(c)
    ctx.db.flush()
    audit.log(ctx.db, "cohort_created", ctx.user, request, "cohort", c.id, name=c.name)
    ctx.db.commit()
    return {"id": str(c.id)}


@router.delete("/cohorts/{cid}")
def delete_cohort(cid: str, request: Request, ctx: Ctx = Depends(require("cohorts"))):
    c = ctx.db.get(Cohort, parse_id(cid))
    if not c:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    audit.log(ctx.db, "cohort_deleted", ctx.user, request, "cohort", c.id, name=c.name)
    ctx.db.delete(c)
    ctx.db.commit()
    return {"ok": True}


# ---------- announcements ----------
@router.get("/announcements")
def announcements(ctx: Ctx = Depends(current)):
    return [{"id": str(a.id), "title": a.title, "body": a.body, "at": a.created_at.isoformat()} for a in ctx.db.scalars(select(Announcement).order_by(Announcement.created_at.desc()).limit(30))]


@router.post("/announcements")
def post_announcement(body: AnnouncementIn, request: Request, ctx: Ctx = Depends(require("announce"))):
    a = Announcement(title=body.title.strip(), body=body.body.strip(), author_id=ctx.user.id)
    ctx.db.add(a)
    ctx.db.flush()
    audit.log(ctx.db, "announcement_posted", ctx.user, request, "announcement", a.id)
    ctx.db.commit()
    return {"id": str(a.id)}


@router.delete("/announcements/{aid}")
def delete_announcement(aid: str, request: Request, ctx: Ctx = Depends(require("announce"))):
    a = ctx.db.get(Announcement, parse_id(aid))
    if not a:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    if a.author_id != ctx.user.id and not ctx.can("users"):
        raise HTTPException(status_code=403, detail={"code": "forbidden"})
    audit.log(ctx.db, "announcement_deleted", ctx.user, request, "announcement", a.id)
    ctx.db.delete(a)
    ctx.db.commit()
    return {"ok": True}


# ---------- audit ----------
@router.get("/admin/audit")
def audit_log(limit: int = Query(default=100, ge=1, le=500), before: int | None = None, action: str | None = Query(default=None, max_length=48), ctx: Ctx = Depends(require("audit"))):
    q = select(AuditLog).order_by(AuditLog.id.desc()).limit(limit)
    if before:
        q = q.where(AuditLog.id < before)
    if action:
        q = q.where(AuditLog.action == action)
    rows = ctx.db.scalars(q).all()
    names = {u.id: u.name for u in ctx.db.scalars(select(User).where(User.id.in_({r.actor_id for r in rows if r.actor_id})))} if rows else {}
    return [{"id": r.id, "ts": r.ts.isoformat(), "actor": names.get(r.actor_id), "actor_role": r.actor_role, "action": r.action, "target_type": r.target_type, "target_id": r.target_id, "ip": r.ip, "detail": r.detail} for r in rows]


# ---------- export ----------
@router.get("/admin/export/trainees.xlsx")
def export_xlsx(request: Request, ctx: Ctx = Depends(require("export"))):
    wb = Workbook()
    ws = wb.active
    ws.title = "Trainees"
    ws.append(["Trainee", "Email", "Program", "Level", "Graduated", "Lessons done", "Lessons in level", "Quiz %", "Trainer eval", "Project status", "Project grade", "Final %", "Eligible", "Trainer"])
    for en in ctx.db.scalars(select(Enrollment)):
        if en.user.status == "deleted":
            continue
        st = public(level_stats(ctx.db, en))
        ws.append([en.user.name, en.user.email, en.program.title_en or en.program.title_ar, st["level"], "yes" if st["graduated"] else "no", st["lessons_done"], st["lessons_total"],
                   st["quiz"], st["eval"], st["project_status"], st["project"], st["final"], "yes" if st["eligible"] else "no", en.trainer.name if en.trainer else ""])
    ws2 = wb.create_sheet("Promotions")
    ws2.append(["Trainee", "Program", "From", "To", "Final %", "Override", "Reason", "Date"])
    for p in ctx.db.scalars(select(Promotion).order_by(Promotion.created_at)):
        en = ctx.db.get(Enrollment, p.enrollment_id)
        ws2.append([en.user.name, en.program.title_en or en.program.title_ar, p.from_level, p.to_level or "graduated", p.final, "yes" if p.override else "no", p.reason, p.created_at.strftime("%Y-%m-%d")])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    audit.log(ctx.db, "export_trainees", ctx.user, request)
    ctx.db.commit()
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": f'attachment; filename="salam-trainees-{datetime.now():%Y%m%d}.xlsx"'})


# ---------- settings ----------
@router.get("/settings")
def get_settings_(ctx: Ctx = Depends(current)):
    return {"rubric": rubric(ctx.db), "grades": get_setting(ctx.db, "grades", DEFAULT_GRADES)}


@router.put("/settings")
def put_settings_(body: SettingsIn, request: Request, ctx: Ctx = Depends(require("settings"))):
    for c in body.rubric:
        if len(c) != 2 or not (c[0].strip() or c[1].strip()) or any(len(x) > 200 for x in c):
            raise HTTPException(status_code=422, detail={"code": "invalid_rubric"})
    grades = []
    for g in body.grades:
        try:
            grades.append({"min": float(g["min"]), "t": [str(g["t"][0])[:60], str(g["t"][1])[:60]]})
        except (KeyError, TypeError, ValueError, IndexError):
            raise HTTPException(status_code=422, detail={"code": "invalid_grades"}) from None
    put_setting(ctx.db, "rubric", body.rubric)
    put_setting(ctx.db, "grades", sorted(grades, key=lambda g: -g["min"]))
    audit.log(ctx.db, "settings_updated", ctx.user, request, criteria=len(body.rubric))
    ctx.db.commit()
    return {"ok": True}


@router.get("/admin/overview")
def overview(ctx: Ctx = Depends(require("users", "audit"))):
    users = ctx.db.scalars(select(User).where(User.status != "deleted")).all()
    return {"users": len(users), "staff": sum(1 for u in users if u.role in STAFF_ROLES), "trainees": sum(1 for u in users if u.role == "trainee"),
            "invited": sum(1 for u in users if u.status == "invited"), "suspended": sum(1 for u in users if u.status == "suspended"),
            "staff_without_mfa": sum(1 for u in users if u.role in STAFF_ROLES and u.status == "active" and not u.mfa_enabled),
            "programs": len(ctx.db.scalars(select(Program)).all()), "enrollments": len(ctx.db.scalars(select(Enrollment)).all())}
