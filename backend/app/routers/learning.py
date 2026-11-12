"""Trainee learning: enrollments, level-gated lessons, server-scored quizzes, reflections, level projects and the journey view."""
import re

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select

from .. import audit
from ..db import utcnow
from ..deps import Ctx, current
from ..models import Enrollment, Lesson, LessonProgress, Program, ProjectSubmission, Promotion, QuizAttempt, Reflection
from ..security import ratelimit
from ..services.progress import best_attempts, done_ids, latest_review, latest_submission, level_lessons, level_stats, public, required_correct
from ..util import parse_id

router = APIRouter(prefix="/api/learn", tags=["learning"])


class EnrollIn(BaseModel):
    program_id: str


class AnswersIn(BaseModel):
    answers: list[int] = Field(max_length=60)


class ReflectionIn(BaseModel):
    text: str = Field(max_length=5000)


class ProjectIn(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    summary: str = Field(min_length=20, max_length=8000)
    link: str = Field(default="", max_length=500)

    @field_validator("link")
    @classmethod
    def _https(cls, v: str) -> str:
        if v and not re.match(r"^https://[^\s<>\"']+$", v):
            raise ValueError("link must be an https URL")
        return v


def self_paced_check(ctx: Ctx, en: Enrollment, request: Request | None = None) -> bool:
    """Self-paced courses complete themselves: once every criterion is met, the learner advances (or graduates) without a trainer step."""
    if not en.program.self_paced or en.graduated_at:
        return False
    st = level_stats(ctx.db, en)
    if not st["eligible"]:
        return False
    last = en.level_position >= len(en.program.levels)
    ctx.db.add(Promotion(enrollment_id=en.id, from_level=en.level_position, to_level=None if last else en.level_position + 1, final=st["final"],
                         approved_by=None, override=False, reason="self-paced completion"))
    if last:
        en.graduated_at = utcnow()
    else:
        en.level_position += 1
    audit.log(ctx.db, "self_paced_completed" if last else "self_paced_advanced", ctx.user, request, "enrollment", en.id, final=st["final"])
    ctx.db.commit()
    return True


def my_enrollment(ctx: Ctx, eid: str) -> Enrollment:
    en = ctx.db.get(Enrollment, parse_id(eid))
    if not en or en.user_id != ctx.user.id:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    return en


def lesson_in(en: Enrollment, lid: str) -> tuple[Lesson, int]:
    lid_u = parse_id(lid)
    for lv in en.program.levels:
        for ls in level_lessons(lv):
            if ls.id == lid_u:
                return ls, lv.position
    raise HTTPException(status_code=404, detail={"code": "not_found"})


def open_upto(en: Enrollment) -> int:
    return len(en.program.levels) if en.graduated_at else en.level_position


def gated_lesson(en: Enrollment, lid: str) -> Lesson:
    ls, pos = lesson_in(en, lid)
    if pos > open_upto(en):
        raise HTTPException(status_code=403, detail={"code": "level_locked"})
    return ls


@router.get("/enrollments")
def my_enrollments(ctx: Ctx = Depends(current)):
    out = []
    for en in ctx.db.scalars(select(Enrollment).where(Enrollment.user_id == ctx.user.id)):
        out.append({"id": str(en.id), "program": {"id": str(en.program_id), "slug": en.program.slug, "self_paced": en.program.self_paced, "title_ar": en.program.title_ar, "title_en": en.program.title_en},
                    "level": en.level_position, "levels": len(en.program.levels), "graduated": en.graduated_at is not None,
                    "trainer": en.trainer.name if en.trainer else None})
    return out


@router.post("/enrollments")
def self_enroll(body: EnrollIn, request: Request, ctx: Ctx = Depends(current)):
    p = ctx.db.get(Program, parse_id(body.program_id))
    if not p or not p.active or not p.self_enroll:
        raise HTTPException(status_code=403, detail={"code": "enrollment_closed"})
    if ctx.db.scalar(select(Enrollment).where(Enrollment.user_id == ctx.user.id, Enrollment.program_id == p.id)):
        raise HTTPException(status_code=409, detail={"code": "already_enrolled"})
    en = Enrollment(user_id=ctx.user.id, program_id=p.id, trainer_id=least_loaded_trainer(ctx, p))
    ctx.db.add(en)
    ctx.db.flush()
    audit.log(ctx.db, "self_enrolled", ctx.user, request, "enrollment", en.id, program=p.slug, trainer=str(en.trainer_id) if en.trainer_id else None)
    ctx.db.commit()
    return {"id": str(en.id), "trainer": en.trainer.name if en.trainer else None}


def least_loaded_trainer(ctx: Ctx, p: Program):
    """Active trainer with the fewest learners in this program (ties: fewest overall), so support is shared evenly."""
    from sqlalchemy import func

    from ..models import User
    trainers = ctx.db.scalars(select(User).where(User.role == "trainer", User.status == "active")).all()
    if not trainers:
        return None
    load = dict(ctx.db.execute(select(Enrollment.trainer_id, func.count()).where(Enrollment.program_id == p.id, Enrollment.graduated_at.is_(None)).group_by(Enrollment.trainer_id)).all())
    total = dict(ctx.db.execute(select(Enrollment.trainer_id, func.count()).group_by(Enrollment.trainer_id)).all())
    return min(trainers, key=lambda t: (load.get(t.id, 0), total.get(t.id, 0), t.created_at)).id


@router.get("/open")
def open_programs(ctx: Ctx = Depends(current)):
    """Programs a learner can join on their own, and whether they already have."""
    mine = {e.program_id: e for e in ctx.db.scalars(select(Enrollment).where(Enrollment.user_id == ctx.user.id))}
    out = []
    for p in ctx.db.scalars(select(Program).where(Program.active.is_(True), Program.self_enroll.is_(True))):
        out.append({"id": str(p.id), "slug": p.slug, "title_ar": p.title_ar, "title_en": p.title_en, "desc_ar": p.desc_ar, "desc_en": p.desc_en,
                    "self_paced": p.self_paced, "enrollment_id": str(mine[p.id].id) if p.id in mine else None})
    return out


@router.get("/enrollments/{eid}")
def enrollment_tree(eid: str, ctx: Ctx = Depends(current)):
    en = my_enrollment(ctx, eid)
    p = en.program
    all_ids = [ls.id for lv in p.levels for ls in level_lessons(lv)]
    done = done_ids(ctx.db, ctx.user.id, all_ids)
    best = best_attempts(ctx.db, ctx.user.id, all_ids)
    upto = open_upto(en)
    levels = []
    for lv in p.levels:
        levels.append({"position": lv.position, "title_ar": lv.title_ar, "title_en": lv.title_en, "desc_ar": lv.desc_ar, "desc_en": lv.desc_en,
                       "locked": lv.position > upto,
                       "courses": [{"title_ar": c.title_ar, "title_en": c.title_en, "lessons": [
                           {"id": str(ls.id), "title_ar": ls.title_ar, "title_en": ls.title_en, "hours": ls.hours, "done": ls.id in done,
                            "has_quiz": bool(ls.questions), "best": ({"score": best[ls.id].score, "total": best[ls.id].total} if ls.id in best else None)}
                           for ls in c.lessons]} for c in lv.courses]})
    return {"id": str(en.id), "program": {"id": str(p.id), "slug": p.slug, "self_paced": p.self_paced, "title_ar": p.title_ar, "title_en": p.title_en}, "trainer": en.trainer.name if en.trainer else None,
            "levels": levels, "stats": public(level_stats(ctx.db, en))}


@router.get("/enrollments/{eid}/lessons/{lid}")
def get_lesson(eid: str, lid: str, ctx: Ctx = Depends(current)):
    en = my_enrollment(ctx, eid)
    ls = gated_lesson(en, lid)
    refl = ctx.db.get(Reflection, (ctx.user.id, ls.id))
    best = best_attempts(ctx.db, ctx.user.id, [ls.id]).get(ls.id)
    return {"id": str(ls.id), "title_ar": ls.title_ar, "title_en": ls.title_en, "hours": ls.hours, "body_ar": ls.body_ar, "body_en": ls.body_en,
            "video_url": ls.video_url, "group_ref": ls.group_ref,
            "questions": [{"q_ar": q.q_ar, "q_en": q.q_en, "options": q.options} for q in ls.questions],  # correct answers never leave the server
            "required_correct": required_correct(ls), "best": {"score": best.score, "total": best.total} if best else None,
            "done": bool(done_ids(ctx.db, ctx.user.id, [ls.id])), "reflection": refl.text if refl else ""}


@router.post("/enrollments/{eid}/lessons/{lid}/quiz")
def submit_quiz(eid: str, lid: str, body: AnswersIn, request: Request, ctx: Ctx = Depends(current)):
    en = my_enrollment(ctx, eid)
    ls = gated_lesson(en, lid)
    if not ls.questions:
        raise HTTPException(status_code=400, detail={"code": "no_quiz"})
    if len(body.answers) != len(ls.questions):
        raise HTTPException(status_code=422, detail={"code": "answer_count"})
    ratelimit.hit(ctx.db, f"quiz:{ctx.user.id}:{ls.id}", 10, 3600)
    right = [a == q.correct for a, q in zip(body.answers, ls.questions, strict=True)]
    score = sum(right)
    ctx.db.add(QuizAttempt(user_id=ctx.user.id, lesson_id=ls.id, score=score, total=len(ls.questions)))
    ctx.db.commit()
    # Long final exams show only the score: per-question right/wrong would hand out the answer key for the next attempt.
    reveal = len(ls.questions) <= 10
    if ctx.db.get(LessonProgress, (ctx.user.id, ls.id)):
        self_paced_check(ctx, en, request)  # a better retake can complete the course
    return {"score": score, "total": len(ls.questions), "passed": score >= required_correct(ls), "right": right if reveal else None}


@router.post("/enrollments/{eid}/lessons/{lid}/complete")
def complete(eid: str, lid: str, ctx: Ctx = Depends(current)):
    en = my_enrollment(ctx, eid)
    ls = gated_lesson(en, lid)
    if ls.questions:
        best = best_attempts(ctx.db, ctx.user.id, [ls.id]).get(ls.id)
        if not best or best.score < required_correct(ls):
            raise HTTPException(status_code=409, detail={"code": "quiz_not_passed"})
    if not ctx.db.get(LessonProgress, (ctx.user.id, ls.id)):
        ctx.db.add(LessonProgress(user_id=ctx.user.id, lesson_id=ls.id))
        ctx.db.commit()
    return {"ok": True, "completed_course": self_paced_check(ctx, en) and en.graduated_at is not None}


@router.put("/enrollments/{eid}/lessons/{lid}/reflection")
def put_reflection(eid: str, lid: str, body: ReflectionIn, ctx: Ctx = Depends(current)):
    en = my_enrollment(ctx, eid)
    ls = gated_lesson(en, lid)
    r = ctx.db.get(Reflection, (ctx.user.id, ls.id))
    if r:
        r.text, r.updated_at = body.text, utcnow()
    else:
        ctx.db.add(Reflection(user_id=ctx.user.id, lesson_id=ls.id, text=body.text))
    ctx.db.commit()
    return {"ok": True}


def evaluation_out(ev) -> dict | None:
    return {"scores": ev.scores, "criteria": ev.criteria, "avg": ev.avg, "note": ev.note, "at": ev.created_at.isoformat()} if ev else None


def journey(db, en: Enrollment) -> dict:
    st = level_stats(db, en)
    pos = st["level"]
    lv = en.program.levels[pos - 1]
    sub, rev = st["_submission"], st["_review"]
    promos = db.scalars(select(Promotion).where(Promotion.enrollment_id == en.id).order_by(Promotion.created_at)).all()
    return {"stats": public(st),
            "project": {"title_ar": lv.project_title_ar, "title_en": lv.project_title_en, "brief_ar": lv.project_brief_ar, "brief_en": lv.project_brief_en, "required": lv.project_required,
                        "submission": {"title": sub.title, "summary": sub.summary, "link": sub.link, "version": sub.version, "at": sub.submitted_at.isoformat()} if sub else None,
                        "review": {"grade": rev.grade, "status": rev.status, "note": rev.note, "at": rev.created_at.isoformat()} if rev else None},
            "evaluation": evaluation_out(st["_evaluation"]),
            "promotions": [{"from": p.from_level, "to": p.to_level, "final": p.final, "override": p.override, "at": p.created_at.isoformat()} for p in promos]}


@router.get("/enrollments/{eid}/journey")
def get_journey(eid: str, ctx: Ctx = Depends(current)):
    return journey(ctx.db, my_enrollment(ctx, eid))


@router.post("/enrollments/{eid}/project")
def submit_project(eid: str, body: ProjectIn, request: Request, ctx: Ctx = Depends(current)):
    en = my_enrollment(ctx, eid)
    if en.graduated_at:
        raise HTTPException(status_code=409, detail={"code": "graduated"})
    pos = en.level_position
    prev = latest_submission(ctx.db, en.id, pos)
    rev = latest_review(ctx.db, prev)
    if rev and rev.status == "approved":
        raise HTTPException(status_code=409, detail={"code": "already_approved"})
    ratelimit.hit(ctx.db, f"project:{en.id}", 10, 86400)
    sub = ProjectSubmission(enrollment_id=en.id, level_position=pos, version=(prev.version + 1 if prev else 1), title=body.title.strip(), summary=body.summary.strip(), link=body.link)
    ctx.db.add(sub)
    audit.log(ctx.db, "project_submitted", ctx.user, request, "enrollment", en.id, level=pos, version=sub.version)
    ctx.db.commit()
    return {"ok": True, "version": sub.version}
