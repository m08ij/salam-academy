"""Program builder: programs → levels → courses → lessons → quiz questions, saved as one validated tree."""
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import func, select

from .. import audit
from ..deps import Ctx, current, require
from ..models import Course, Enrollment, Lesson, Level, Program, Question
from ..util import parse_id

router = APIRouter(prefix="/api/programs", tags=["programs"])


class QuestionIn(BaseModel):
    q_ar: str = Field(min_length=1, max_length=1000)
    q_en: str = Field(default="", max_length=1000)
    options: list[list[str]] = Field(min_length=2, max_length=6)
    correct: int = Field(ge=0)

    @model_validator(mode="after")
    def _check(self):
        if self.correct >= len(self.options):
            raise ValueError("correct index out of range")
        for o in self.options:
            if len(o) != 2 or not (o[0].strip() or o[1].strip()) or any(len(x) > 300 for x in o):
                raise ValueError("each option must be [ar, en] and not empty")
        return self


class LessonIn(BaseModel):
    id: str | None = None
    title_ar: str = Field(min_length=1, max_length=200)
    title_en: str = Field(default="", max_length=200)
    hours: float = Field(default=1, gt=0, le=40)
    body_ar: str = Field(default="", max_length=60000)
    body_en: str = Field(default="", max_length=60000)
    video_url: str = Field(default="", max_length=500)
    group_ref: int | None = None
    questions: list[QuestionIn] = Field(default_factory=list, max_length=20)

    @field_validator("video_url")
    @classmethod
    def _https(cls, v: str) -> str:
        if v and not re.match(r"^https://[^\s<>\"']+$", v):
            raise ValueError("video_url must be an https URL")
        return v


class CourseIn(BaseModel):
    id: str | None = None
    title_ar: str = Field(min_length=1, max_length=200)
    title_en: str = Field(default="", max_length=200)
    lessons: list[LessonIn] = Field(default_factory=list, max_length=100)


class LevelIn(BaseModel):
    id: str | None = None
    title_ar: str = Field(min_length=1, max_length=200)
    title_en: str = Field(default="", max_length=200)
    desc_ar: str = Field(default="", max_length=4000)
    desc_en: str = Field(default="", max_length=4000)
    min_quiz: float = Field(default=70, ge=0, le=100)
    min_eval: float = Field(default=3.5, ge=1, le=5)
    min_project: float = Field(default=70, ge=0, le=100)
    min_final: float = Field(default=70, ge=0, le=100)
    w_quiz: int = Field(default=40, ge=0, le=100)
    w_eval: int = Field(default=30, ge=0, le=100)
    w_project: int = Field(default=30, ge=0, le=100)
    project_required: bool = True
    project_title_ar: str = Field(default="", max_length=200)
    project_title_en: str = Field(default="", max_length=200)
    project_brief_ar: str = Field(default="", max_length=4000)
    project_brief_en: str = Field(default="", max_length=4000)
    courses: list[CourseIn] = Field(min_length=1, max_length=30)

    @model_validator(mode="after")
    def _check(self):
        if self.w_quiz + self.w_eval + self.w_project != 100:
            raise ValueError("weights must add up to 100")
        if not any(c.lessons for c in self.courses):
            raise ValueError("each level needs at least one lesson")
        return self


class ProgramIn(BaseModel):
    slug: str | None = Field(default=None, pattern=r"^[a-z0-9-]{2,64}$")
    title_ar: str = Field(min_length=1, max_length=200)
    title_en: str = Field(default="", max_length=200)
    desc_ar: str = Field(default="", max_length=4000)
    desc_en: str = Field(default="", max_length=4000)
    active: bool = False
    self_enroll: bool = False
    levels: list[LevelIn] = Field(min_length=1, max_length=20)


LEVEL_FIELDS = [f for f in LevelIn.model_fields if f not in ("id", "courses")]
LESSON_FIELDS = ["title_ar", "title_en", "hours", "body_ar", "body_en", "video_url", "group_ref"]


def tree(p: Program, with_answers: bool) -> dict:
    return {"id": str(p.id), "slug": p.slug, "title_ar": p.title_ar, "title_en": p.title_en, "desc_ar": p.desc_ar, "desc_en": p.desc_en,
            "active": p.active, "self_enroll": p.self_enroll, "updated_at": p.updated_at.isoformat(),
            "levels": [{"id": str(lv.id), "position": lv.position, **{f: getattr(lv, f) for f in LEVEL_FIELDS},
                        "courses": [{"id": str(c.id), "title_ar": c.title_ar, "title_en": c.title_en,
                                     "lessons": [{"id": str(ls.id), **{f: getattr(ls, f) for f in LESSON_FIELDS},
                                                  "questions": [{"q_ar": q.q_ar, "q_en": q.q_en, "options": q.options, **({"correct": q.correct} if with_answers else {})} for q in ls.questions]}
                                                 for ls in c.lessons]} for c in lv.courses]} for lv in p.levels]}


def summary(db, p: Program) -> dict:
    n = db.scalar(select(func.count()).select_from(Enrollment).where(Enrollment.program_id == p.id)) or 0
    return {"id": str(p.id), "slug": p.slug, "title_ar": p.title_ar, "title_en": p.title_en, "desc_ar": p.desc_ar, "desc_en": p.desc_en, "active": p.active,
            "self_enroll": p.self_enroll, "levels": len(p.levels), "courses": sum(len(lv.courses) for lv in p.levels),
            "lessons": sum(len(c.lessons) for lv in p.levels for c in lv.courses), "enrollments": n}


def _maybe(raw: str | None) -> uuid.UUID | None:
    if not raw:
        return None
    try:
        return uuid.UUID(raw)
    except ValueError:
        return None


def apply_tree(db, p: Program, body: ProgramIn) -> None:
    """Replaces the program tree. Items sent with their existing id keep it, so learners' progress on them survives."""
    for f in ("title_ar", "title_en", "desc_ar", "desc_en", "active", "self_enroll"):
        setattr(p, f, getattr(body, f))
    old_levels = {lv.id: lv for lv in p.levels}
    old_courses = {c.id: c for lv in p.levels for c in lv.courses}
    old_lessons = {ls.id: ls for lv in p.levels for c in lv.courses for ls in c.lessons}
    new_levels = []
    for i, lvin in enumerate(body.levels, start=1):
        lv = old_levels.get(_maybe(lvin.id)) or Level()
        lv.position = i
        for f in LEVEL_FIELDS:
            setattr(lv, f, getattr(lvin, f))
        courses = []
        for j, cin in enumerate(lvin.courses, start=1):
            c = old_courses.get(_maybe(cin.id)) or Course()
            c.position, c.title_ar, c.title_en = j, cin.title_ar, cin.title_en
            lessons = []
            for k, lin in enumerate(cin.lessons, start=1):
                ls = old_lessons.pop(_maybe(lin.id), None) or Lesson()
                ls.position = k
                for f in LESSON_FIELDS:
                    setattr(ls, f, getattr(lin, f))
                ls.questions = [Question(position=qi, q_ar=q.q_ar, q_en=q.q_en, options=q.options, correct=q.correct) for qi, q in enumerate(lin.questions, start=1)]
                lessons.append(ls)
            c.lessons = lessons
            courses.append(c)
        lv.courses = courses
        new_levels.append(lv)
    p.levels = new_levels
    for e in db.scalars(select(Enrollment).where(Enrollment.program_id == p.id)) if p.id else []:
        e.level_position = min(e.level_position, len(new_levels))


@router.get("")
def list_programs(ctx: Ctx = Depends(current)):
    q = select(Program).order_by(Program.title_ar)
    if not ctx.can("preview"):
        q = q.where(Program.active.is_(True))
    return [summary(ctx.db, p) for p in ctx.db.scalars(q)]


@router.get("/{pid}")
def get_program(pid: str, ctx: Ctx = Depends(require("programs", "preview"))):
    p = ctx.db.get(Program, parse_id(pid))
    if not p:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    return tree(p, with_answers=ctx.can("programs"))


@router.post("")
def create_program(body: ProgramIn, request: Request, ctx: Ctx = Depends(require("programs"))):
    slug = body.slug or ("p-" + uuid.uuid4().hex[:10])
    if ctx.db.scalar(select(Program).where(Program.slug == slug)):
        raise HTTPException(status_code=409, detail={"code": "slug_exists"})
    p = Program(slug=slug, title_ar=body.title_ar)
    ctx.db.add(p)
    apply_tree(ctx.db, p, body)
    ctx.db.flush()
    audit.log(ctx.db, "program_created", ctx.user, request, "program", p.id, title=p.title_ar)
    ctx.db.commit()
    return tree(p, True)


@router.put("/{pid}")
def update_program(pid: str, body: ProgramIn, request: Request, ctx: Ctx = Depends(require("programs"))):
    p = ctx.db.get(Program, parse_id(pid))
    if not p:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    apply_tree(ctx.db, p, body)
    audit.log(ctx.db, "program_updated", ctx.user, request, "program", p.id, title=p.title_ar, levels=len(body.levels))
    ctx.db.commit()
    ctx.db.refresh(p)
    return tree(p, True)


@router.delete("/{pid}")
def delete_program(pid: str, request: Request, ctx: Ctx = Depends(require("programs"))):
    p = ctx.db.get(Program, parse_id(pid))
    if not p:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    if ctx.db.scalar(select(func.count()).select_from(Enrollment).where(Enrollment.program_id == p.id)):
        raise HTTPException(status_code=409, detail={"code": "has_enrollments"})
    audit.log(ctx.db, "program_deleted", ctx.user, request, "program", p.id, title=p.title_ar)
    ctx.db.delete(p)
    ctx.db.commit()
    return {"ok": True}
