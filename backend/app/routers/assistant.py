"""Course assistant API: signed-in learners ask about the Identity course; answers come only from course material."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select

from .. import audit
from ..config import get_settings
from ..deps import Ctx, current
from ..models import Enrollment, Program
from ..security import ratelimit
from ..services import assistant, knowledge

router = APIRouter(prefix="/api/assistant", tags=["assistant"])
SLUG = "identity"


class AskIn(BaseModel):
    question: str = Field(min_length=3, max_length=600)
    lang: str = Field(default="ar", pattern="^(ar|en)$")


def _access(ctx: Ctx) -> str:
    """'learner' | 'staff' | '' — who may ask right now."""
    s = get_settings()
    if ctx.can("preview") and s.ai_api_key:
        return "staff"  # the team tests before learners get it
    if s.ai_enabled_for_learners and s.ai_api_key and ctx.can("learn"):
        p = ctx.db.scalar(select(Program).where(Program.slug == SLUG))
        if p and ctx.db.scalar(select(Enrollment).where(Enrollment.user_id == ctx.user.id, Enrollment.program_id == p.id)):
            return "learner"
    return ""


@router.get("/status")
def status(ctx: Ctx = Depends(current)):
    s = get_settings()
    return {"available": bool(_access(ctx)), "configured": bool(s.ai_api_key), "for_learners": s.ai_enabled_for_learners,
            "daily_limit": s.ai_daily_limit, "used_today": ratelimit.count(ctx.db, f"ai:{ctx.user.id}", 86400)}


@router.post("/ask")
def ask(body: AskIn, request: Request, ctx: Ctx = Depends(current)):
    s = get_settings()
    who = _access(ctx)
    if not who:
        raise HTTPException(status_code=403, detail={"code": "assistant_unavailable"})
    ratelimit.hit(ctx.db, f"ai:{ctx.user.id}", s.ai_daily_limit, 86400)
    hits = knowledge.search(ctx.db, SLUG, body.question, k=8)
    sources = [{"source": r.source, "ref": r.ref, "title": r.title, "label": assistant.label(r.source, r.ref, body.lang)} for _, r in hits]
    # de-duplicate citations (several passages can come from the same lesson/page)
    seen, uniq = set(), []
    for src in sources:
        if src["label"] not in seen:
            seen.add(src["label"])
            uniq.append(src)
    audit.log(ctx.db, "assistant_question", ctx.user, request, "program", SLUG, who=who, hits=len(hits))  # question text is not stored
    ctx.db.commit()
    if not hits:
        msg = ("لم أجد في مواد الدورة ما يتعلق بسؤالك. جرّب صياغة أخرى، أو اسأل مدربك." if body.lang == "ar"
               else "I couldn't find anything about this in the course material. Try rephrasing, or ask your trainer.")
        return {"answer": msg, "sources": [], "grounded": False, "fallback": False}
    passages = [(r.source, r.ref, r.title, r.text) for _, r in hits]
    try:
        answer = assistant.complete(assistant.build_messages(body.question, passages, body.lang))
        return {"answer": answer, "sources": uniq, "grounded": True, "fallback": False}
    except assistant.ProviderError:
        # Graceful fallback: show the most relevant material instead of an answer.
        head = ("المساعد غير متاح الآن. هذه أقرب المقاطع من مواد الدورة لسؤالك:" if body.lang == "ar"
                else "The assistant is unavailable right now. These are the closest passages from the course material:")
        excerpts = [{"label": assistant.label(r.source, r.ref, body.lang), "title": r.title, "text": r.text[:600]} for _, r in hits[:3]]
        return {"answer": head, "sources": uniq, "grounded": True, "fallback": True, "excerpts": excerpts}
