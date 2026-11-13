"""Course numbers for the team, glossary for everyone, and AI generation of quizzes/glossary from the course text."""
import json
import re
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from .. import audit
from ..db import utcnow
from ..deps import Ctx, current, require
from ..models import AuditLog, Enrollment, LessonProgress, Program, Question, QuizAttempt, Setting
from ..services import assistant
from ..services.progress import level_lessons

router = APIRouter(prefix="/api", tags=["insights"])
SLUG = "identity"


def _program(db) -> Program:
    p = db.scalar(select(Program).where(Program.slug == SLUG))
    if not p:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    return p


@router.get("/admin/insights")
def insights(ctx: Ctx = Depends(require("audit"))):
    db, p = ctx.db, _program(ctx.db)
    ens = db.scalars(select(Enrollment).where(Enrollment.program_id == p.id)).all()
    users = [e.user_id for e in ens]
    lessons = [ls for lv in p.levels for ls in level_lessons(lv)]
    week = utcnow() - timedelta(days=7)
    done = dict(db.execute(select(LessonProgress.lesson_id, func.count()).where(LessonProgress.user_id.in_(users or [None])).group_by(LessonProgress.lesson_id)).all())
    active = db.scalar(select(func.count(func.distinct(LessonProgress.user_id))).where(LessonProgress.user_id.in_(users or [None]), LessonProgress.completed_at > week)) or 0
    exam = next((ls for ls in lessons if len(ls.questions) > 10), None)
    scores = [a.score / a.total for a in db.scalars(select(QuizAttempt).where(QuizAttempt.lesson_id == exam.id))] if exam else []
    q7 = db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == "assistant_question", AuditLog.ts > week)) or 0
    q_all = db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == "assistant_question")) or 0
    return {"enrolled": len(ens), "completed": sum(1 for e in ens if e.graduated_at), "active_7d": active,
            "avg_exam": round(100 * sum(scores) / len(scores)) if scores else None,
            "assistant_7d": q7, "assistant_all": q_all,
            "lessons": [{"title": ls.title_ar, "done": done.get(ls.id, 0)} for ls in lessons]}


@router.get("/learn/glossary")
def glossary(ctx: Ctx = Depends(current)):
    s = ctx.db.get(Setting, f"glossary:{SLUG}")
    return s.value.get("terms", []) if s else []


class GenIn(BaseModel):
    kind: str = Field(pattern="^(quizzes|glossary)$")
    limit: int = Field(default=3, ge=1, le=6)


def _json(text: str):
    m = re.search(r"(\[.*\]|\{.*\})", text, re.S)
    return json.loads(m.group(1)) if m else None


@router.post("/admin/content/identity/generate")
def generate(body: GenIn, request: Request, ctx: Ctx = Depends(require("programs"))):
    """Drafts short section quizzes (2 questions per section without one) or the course glossary, using the course text only.
    Runs a few sections per call so it fits request time limits; call again until remaining is 0. Staff can edit results in Programs."""
    db, p = ctx.db, _program(ctx.db)
    lessons = [ls for lv in p.levels for ls in level_lessons(lv) if len(ls.questions) <= 10]
    if body.kind == "quizzes":
        todo = [ls for ls in lessons if not ls.questions and len(ls.body_ar.split()) > 120]
        made = 0
        for ls in todo[: body.limit]:
            prompt = [{"role": "system", "content": "أنت تكتب أسئلة فهم قصيرة لدرس تعليمي. استخدم نص الدرس فقط. أعد JSON فقط بدون شرح."},
                      {"role": "user", "content": f"نص الدرس «{ls.title_ar}»:\n{ls.body_ar[:3500]}\n\nاكتب سؤالين اختيار من متعدد يقيسان فهم أهم فكرتين في الدرس، لكل سؤال ٤ خيارات قصيرة وخيار واحد صحيح.\nالصيغة: [{{\"q\":\"...\",\"options\":[\"...\",\"...\",\"...\",\"...\"],\"correct\":0}}]"}]
            try:
                data = _json(assistant.complete(prompt))
            except (assistant.ProviderError, ValueError):
                continue
            qs = [q for q in (data or []) if isinstance(q, dict) and isinstance(q.get("options"), list) and len(q["options"]) == 4 and isinstance(q.get("correct"), int) and 0 <= q["correct"] < 4 and str(q.get("q", "")).strip()][:2]
            for i, q in enumerate(qs, 1):
                ls.questions.append(Question(position=i, q_ar=str(q["q"])[:500], q_en="", options=[[str(o)[:200], ""] for o in q["options"]], correct=q["correct"]))
            made += bool(qs)
            db.commit()
        remaining = len([ls for ls in lessons if not ls.questions and len(ls.body_ar.split()) > 120])
        audit.log(db, "quizzes_generated", ctx.user, request, "program", p.id, lessons=made)
        db.commit()
        return {"generated": made, "remaining": remaining}
    terms = ["الهوية", "العلامة الشخصية", "منظومة الهوية", "القناعة", "الإيمان", "الإيمان بالغيب", "منظومة القيم", "القيم الحاكمة", "ملامح الهوية",
             "الذكاء العاطفي", "الوعي بالذات", "إدارة الذات", "التقييم 360", "لوحة الرؤية", "ثبات الهوية"]
    from ..services import knowledge
    out = []
    for t in terms:
        hits = knowledge.search(db, SLUG, f"ما هو {t} تعريف معنى", k=3)
        if not hits:
            continue
        ctxt = "\n".join(f"[{assistant.label(r.source, r.ref, 'ar')}] {r.text[:700]}" for _, r in hits)
        try:
            d = assistant.complete([{"role": "system", "content": "عرّف المصطلح كما تشرحه المقتطفات فقط، في جملتين بالعربية. لا تضف معلومات من خارجها."},
                                    {"role": "user", "content": f"المقتطفات:\n{ctxt}\n\nالمصطلح: {t}"}])
        except assistant.ProviderError:
            continue
        out.append({"term": t, "def": d.strip()[:600], "ref": assistant.label(hits[0][1].source, hits[0][1].ref, "ar")})
    s = db.get(Setting, f"glossary:{SLUG}") or Setting(key=f"glossary:{SLUG}", value={})
    s.value = {"terms": out}
    db.merge(s)
    audit.log(db, "glossary_generated", ctx.user, request, "program", p.id, terms=len(out))
    db.commit()
    return {"generated": len(out), "remaining": 0}
