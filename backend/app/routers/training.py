"""Trainer console: assigned trainees only (unless the role may see all), project review, rubric evaluation, promotion."""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select

from .. import audit
from ..db import utcnow
from ..deps import Ctx, require
from ..models import Enrollment, Evaluation, GrowthPlan, LessonProgress, ProjectReview, Promotion, QuizAttempt, Reflection
from ..services.progress import level_lessons, level_stats, public
from ..util import parse_id, rubric
from .learning import evaluation_out, journey

router = APIRouter(prefix="/api/training", tags=["training"])


class ReviewIn(BaseModel):
    grade: float = Field(ge=0, le=100)
    status: str = Field(pattern="^(approved|revise)$")
    note: str = Field(default="", max_length=4000)


class EvalIn(BaseModel):
    scores: list[int] = Field(min_length=1, max_length=12)
    note: str = Field(default="", max_length=4000)


class OverrideIn(BaseModel):
    reason: str = Field(min_length=10, max_length=1000)


def visible(ctx: Ctx, en: Enrollment) -> bool:
    return ctx.can("train_all") or en.trainer_id == ctx.user.id


def get_en(ctx: Ctx, eid: str) -> Enrollment:
    en = ctx.db.get(Enrollment, parse_id(eid))
    if not en or not visible(ctx, en) or en.user.status == "deleted":
        raise HTTPException(status_code=404, detail={"code": "not_found"})  # 404, not 403: do not reveal others' trainees
    return en


def alerts(db, en: Enrollment, st: dict) -> list[str]:
    """inactive: no activity for 7+ days (not graduated); exam: 2+ final-exam attempts below the pass mark."""
    from datetime import datetime, timedelta

    from .learning import last_activity
    out = []
    la = last_activity(db, en)
    if not st["graduated"] and la and datetime.fromisoformat(la) < datetime.utcnow() - timedelta(days=7):
        out.append("inactive")
    exam = [ls for lv in en.program.levels for ls in level_lessons(lv) if len(ls.questions) > 10]
    if exam and not st["graduated"]:
        tries = db.scalars(select(QuizAttempt).where(QuizAttempt.user_id == en.user_id, QuizAttempt.lesson_id == exam[0].id)).all()
        if len(tries) >= 2 and max(a.score / a.total for a in tries) < 0.7:
            out.append("exam")
    return out


class CommentIn(BaseModel):
    text: str = Field(min_length=2, max_length=1500)


@router.post("/enrollments/{eid}/lessons/{lid}/comment")
def comment(eid: str, lid: str, body: CommentIn, request: Request, ctx: Ctx = Depends(require("train"))):
    from ..models import LessonComment
    en = get_en(ctx, eid)
    ls = next((x for lv in en.program.levels for x in level_lessons(lv) if str(x.id) == lid), None)
    if not ls:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    ctx.db.add(LessonComment(enrollment_id=en.id, lesson_id=ls.id, author_id=ctx.user.id, text=body.text.strip()))
    audit.log(ctx.db, "trainer_comment", ctx.user, request, "enrollment", en.id)
    ctx.db.commit()
    return {"ok": True}


@router.get("/trainees")
def trainees(scope: str = Query(default="mine", pattern=r"^(mine|all|none|[0-9a-f-]{36})$"), ctx: Ctx = Depends(require("train"))):
    q = select(Enrollment)
    if not ctx.can("train_all") or scope == "mine":
        q = q.where(Enrollment.trainer_id == ctx.user.id)
    elif scope == "none":
        q = q.where(Enrollment.trainer_id.is_(None))
    elif scope != "all":
        q = q.where(Enrollment.trainer_id == parse_id(scope))
    out = []
    for en in ctx.db.scalars(q):
        if en.user.status == "deleted":
            continue
        st = public(level_stats(ctx.db, en))
        out.append({"enrollment_id": str(en.id), "user": {"id": str(en.user_id), "name": en.user.name}, "program": {"self_paced": en.program.self_paced, "title_ar": en.program.title_ar, "title_en": en.program.title_en},
                    "trainer": en.trainer.name if en.trainer else None, "stats": st, "alerts": alerts(ctx.db, en, st), "last_login_at": en.user.last_login_at.isoformat() if en.user.last_login_at else None})
    return out


@router.get("/enrollments/{eid}")
def trainee_file(eid: str, ctx: Ctx = Depends(require("train"))):
    en = get_en(ctx, eid)
    db, u = ctx.db, en.user
    lv = en.program.levels[min(en.level_position, len(en.program.levels)) - 1]
    lessons = level_lessons(lv)
    ids = [ls.id for ls in lessons]
    done = {p.lesson_id: p.completed_at for p in db.scalars(select(LessonProgress).where(LessonProgress.user_id == u.id, LessonProgress.lesson_id.in_(ids)))} if ids else {}
    attempts, tries = {}, {}
    for a in db.scalars(select(QuizAttempt).where(QuizAttempt.user_id == u.id, QuizAttempt.lesson_id.in_(ids))) if ids else []:
        tries[a.lesson_id] = tries.get(a.lesson_id, 0) + 1
        cur = attempts.get(a.lesson_id)
        if not cur or a.score / a.total > cur[0] / cur[1]:
            attempts[a.lesson_id] = (a.score, a.total)
    from ..models import LessonComment
    notes: dict = {}
    for c in db.scalars(select(LessonComment).where(LessonComment.enrollment_id == en.id).order_by(LessonComment.created_at)):
        notes.setdefault(c.lesson_id, []).append(c.text)
    refl = []
    if u.share_reflections:  # private unless the trainee chose to share
        all_ids = [ls.id for level in en.program.levels for ls in level_lessons(level)]
        titles = {ls.id: [ls.title_ar, ls.title_en] for level in en.program.levels for ls in level_lessons(level)}
        refl = [{"lesson": titles.get(r.lesson_id), "text": r.text} for r in db.scalars(select(Reflection).where(Reflection.user_id == u.id, Reflection.lesson_id.in_(all_ids)))] if all_ids else []
    plan = (db.get(GrowthPlan, u.id).data if db.get(GrowthPlan, u.id) else None) if u.share_plan else None
    evals = db.scalars(select(Evaluation).where(Evaluation.enrollment_id == en.id).order_by(Evaluation.created_at.desc())).all()
    return {"enrollment_id": str(en.id), "user": {"id": str(u.id), "name": u.name, "email": u.email}, "trainer": en.trainer.name if en.trainer else None,
            "program": {"title_ar": en.program.title_ar, "title_en": en.program.title_en, "levels": [{"position": x.position, "title_ar": x.title_ar, "title_en": x.title_en} for x in en.program.levels]},
            "journey": journey(db, en), "rubric": rubric(db),
            "lessons": [{"id": str(ls.id), "title_ar": ls.title_ar, "title_en": ls.title_en, "done_at": done[ls.id].isoformat() if ls.id in done else None, "best": attempts.get(ls.id), "notes": notes.get(ls.id, []),
                         "attempts": tries.get(ls.id, 0), "questions": len(ls.questions)} for ls in lessons],
            "shared": {"reflections": u.share_reflections, "plan": u.share_plan}, "reflections": refl, "plan": plan,
            "evaluations": [evaluation_out(e) | {"level": e.level_position} for e in evals]}


@router.post("/enrollments/{eid}/review")
def review_project(eid: str, body: ReviewIn, request: Request, ctx: Ctx = Depends(require("train"))):
    en = get_en(ctx, eid)
    st = level_stats(ctx.db, en)
    sub = st["_submission"]
    if not sub:
        raise HTTPException(status_code=409, detail={"code": "no_submission"})
    ctx.db.add(ProjectReview(submission_id=sub.id, reviewer_id=ctx.user.id, grade=body.grade, status=body.status, note=body.note.strip()))
    audit.log(ctx.db, "project_reviewed", ctx.user, request, "enrollment", en.id, level=st["level"], grade=body.grade, status=body.status)
    ctx.db.commit()
    return {"ok": True}


@router.post("/enrollments/{eid}/evaluation")
def evaluate(eid: str, body: EvalIn, request: Request, ctx: Ctx = Depends(require("train"))):
    en = get_en(ctx, eid)
    crit = rubric(ctx.db)
    if len(body.scores) != len(crit) or any(s < 1 or s > 5 for s in body.scores):
        raise HTTPException(status_code=422, detail={"code": "invalid_scores", "criteria": len(crit)})
    avg = round(sum(body.scores) / len(body.scores), 2)
    ctx.db.add(Evaluation(enrollment_id=en.id, level_position=en.level_position, trainer_id=ctx.user.id, scores=body.scores, criteria=crit, avg=avg, note=body.note.strip()))
    audit.log(ctx.db, "trainee_evaluated", ctx.user, request, "enrollment", en.id, level=en.level_position, avg=avg)
    ctx.db.commit()
    return {"ok": True, "avg": avg}


def _promote(ctx: Ctx, en: Enrollment, request: Request, final: float, override: bool, reason: str = "") -> dict:
    last = en.level_position >= len(en.program.levels)
    p = Promotion(enrollment_id=en.id, from_level=en.level_position, to_level=None if last else en.level_position + 1, final=final, approved_by=ctx.user.id, override=override, reason=reason)
    ctx.db.add(p)
    if last:
        en.graduated_at = utcnow()
    else:
        en.level_position += 1
    audit.log(ctx.db, "trainee_override_promoted" if override else "trainee_promoted", ctx.user, request, "enrollment", en.id, from_level=p.from_level, to_level=p.to_level, final=final, reason=reason or None)
    ctx.db.commit()
    return {"ok": True, "from": p.from_level, "to": p.to_level, "graduated": last}


@router.post("/enrollments/{eid}/promote")
def promote(eid: str, request: Request, ctx: Ctx = Depends(require("train"))):
    en = get_en(ctx, eid)
    if en.graduated_at:
        raise HTTPException(status_code=409, detail={"code": "graduated"})
    st = level_stats(ctx.db, en)
    if not st["eligible"]:
        raise HTTPException(status_code=409, detail={"code": "not_eligible", "checks": st["checks"]})
    return _promote(ctx, en, request, st["final"], override=False)


@router.post("/enrollments/{eid}/override")
def override(eid: str, body: OverrideIn, request: Request, ctx: Ctx = Depends(require("override"))):
    en = get_en(ctx, eid)
    if en.graduated_at:
        raise HTTPException(status_code=409, detail={"code": "graduated"})
    st = level_stats(ctx.db, en)
    return _promote(ctx, en, request, st["final"], override=True, reason=body.reason.strip())
