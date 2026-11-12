"""Course content import (kept out of the public repository): staff with the "programs" permission upload a JSON bundle.

Bundle: {"lessons": [{"n", "title", "body"}], "exam": [{"q", "options", "correct"}], "book": [{"page", "text"}]}
Re-importing updates text in place (same lesson rows, so learner progress is kept) and never deletes lessons.
"""
import math

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, select

from .. import audit
from ..deps import Ctx, require
from ..models import Course, KnowledgeChunk, Lesson, Level, Program, Question
from ..services import knowledge

router = APIRouter(prefix="/api/admin/content", tags=["content"])

SLUG = "identity"
# The 23 script sections grouped into four parts; the final exam closes the last part.
PARTS = [
    ((1, 6), ("الجزء الأول: من أنت؟ الهوية والعلامة الشخصية", "Part 1: Who are you? Identity and personal brand")),
    ((7, 13), ("الجزء الثاني: الإيمان ومنظومة القناعات", "Part 2: Faith and the belief system")),
    ((14, 19), ("الجزء الثالث: القيم والمهارات وملامح الشخصية", "Part 3: Values, skills and personal traits")),
    ((20, 23), ("الجزء الرابع: هويتي المتكاملة", "Part 4: My integrated identity")),
]
EXAM_TITLE = ("الاختبار النهائي", "Final exam")


class LessonIn(BaseModel):
    n: int = Field(ge=1, le=200)
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(max_length=60000)


class ExamQ(BaseModel):
    q: str = Field(min_length=2, max_length=1000)
    options: list[str] = Field(min_length=2, max_length=8)
    correct: int = Field(ge=0)

    @field_validator("correct")
    @classmethod
    def _in_range(cls, v, info):
        opts = info.data.get("options") or []
        if v >= len(opts):
            raise ValueError("correct index out of range")
        return v


class Page(BaseModel):
    page: int = Field(ge=1, le=2000)
    text: str = Field(max_length=20000)


class BundleIn(BaseModel):
    lessons: list[LessonIn] = Field(min_length=1, max_length=100)
    exam: list[ExamQ] = Field(default_factory=list, max_length=60)
    book: list[Page] = Field(default_factory=list, max_length=2000)


def _hours(text: str) -> float:
    return max(0.1, round(len(text.split()) / 180 / 60 + 0.05, 1))  # ~180 words/min reading


@router.post("/identity")
def import_identity(body: BundleIn, request: Request, ctx: Ctx = Depends(require("programs"))):
    db = ctx.db
    by_n = {ls.n: ls for ls in body.lessons}
    p = db.scalar(select(Program).where(Program.slug == SLUG))
    created = p is None
    if created:
        p = Program(slug=SLUG, title_ar="هويتي المتكاملة وعلامتي الشخصية", title_en="My Integrated Identity & Personal Brand",
                    desc_ar="دورة ذاتية الوتيرة لبناء الهوية والعلامة الشخصية على منظومة القيم، مع مدرب يتابع تقدّمك ويساندك عند الحاجة.",
                    desc_en="A self-paced course on building your identity and personal brand on a values system, with a trainer who follows your progress and supports you when needed.",
                    active=True, self_paced=True)
        p.levels.append(Level(position=1, title_ar="هويتي المتكاملة وعلامتي الشخصية", title_en="My Integrated Identity & Personal Brand",
                              min_quiz=70, min_eval=0, min_project=0, min_final=70, w_quiz=100, w_eval=0, w_project=0, project_required=False))
        db.add(p)
        db.flush()
    p.self_enroll = True  # learners join on their own; a trainer is assigned automatically
    lv = p.levels[0]
    courses = {c.position: c for c in lv.courses}
    for ci, ((a, b), (t_ar, t_en)) in enumerate(PARTS, 1):
        c = courses.get(ci) or Course(position=ci, title_ar=t_ar, title_en=t_en)
        if ci not in courses:
            lv.courses.append(c)
        c.title_ar, c.title_en = t_ar, t_en
        existing = {ls.position: ls for ls in c.lessons}
        pos = 0
        for n in range(a, b + 1):
            src = by_n.get(n)
            if not src:
                continue
            pos += 1
            ls = existing.get(pos) or Lesson(position=pos, title_ar="")
            if pos not in existing:
                c.lessons.append(ls)
            ls.title_ar, ls.title_en, ls.body_ar, ls.hours = src.title, src.title, src.body, _hours(src.body)
        if ci == len(PARTS) and body.exam:
            pos += 1
            ex = existing.get(pos) or Lesson(position=pos, title_ar="")
            if pos not in existing:
                c.lessons.append(ex)
            ex.title_ar, ex.title_en, ex.hours = EXAM_TITLE[0], EXAM_TITLE[1], 0.5
            ex.body_ar = f"اختبار نهائي من {len(body.exam)} سؤالًا يغطي محاور الدورة. تحتاج {math.ceil(len(body.exam) * 0.7)} إجابة صحيحة على الأقل (٧٠٪) لإتمام الدورة، ويمكنك إعادة المحاولة."
            ex.body_en = f"A {len(body.exam)}-question final exam covering the course. You need at least 70% to complete the course; you can retake it."
            ex.questions = [Question(position=i, q_ar=q.q, q_en="", options=[[o, ""] for o in q.options], correct=q.correct) for i, q in enumerate(body.exam, 1)]
    db.flush()
    # Assistant knowledge: replaced as a whole (it is derived data, not learner data).
    db.execute(delete(KnowledgeChunk).where(KnowledgeChunk.program_slug == SLUG))
    chunks = knowledge.chunk_lessons([(ls.n, ls.title, ls.body) for ls in body.lessons]) + knowledge.chunk_pages([(pg.page, pg.text) for pg in body.book])
    for src, ref, title, text in chunks:
        db.add(KnowledgeChunk(program_slug=SLUG, source=src, ref=str(ref), title=title[:300], text=text))
    audit.log(db, "course_content_imported", ctx.user, request, "program", p.id, lessons=len(body.lessons), exam=len(body.exam), pages=len(body.book))
    db.commit()
    knowledge.invalidate(SLUG)
    return {"program_id": str(p.id), "created": created, "lessons": len(body.lessons), "exam_questions": len(body.exam), "knowledge_chunks": len(chunks)}


@router.get("/identity/status")
def identity_status(ctx: Ctx = Depends(require("programs"))):
    p = ctx.db.scalar(select(Program).where(Program.slug == SLUG))
    n = len(ctx.db.scalars(select(KnowledgeChunk.id).where(KnowledgeChunk.program_slug == SLUG)).all())
    if not p:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    lessons = [ls for c in p.levels[0].courses for ls in c.lessons]
    return {"program_id": str(p.id), "lessons": len(lessons), "knowledge_chunks": n}
