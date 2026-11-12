"""Course assistant API: signed-in learners ask about the Identity course; answers come only from course material."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select

from .. import audit
from ..config import get_settings
from ..deps import Ctx, current
from ..security import ratelimit
from ..services import assistant, knowledge

router = APIRouter(prefix="/api/assistant", tags=["assistant"])
SLUG = "identity"
_answers: dict[tuple[str, str], str] = {}  # answer cache (per process); cleared on content import


class AskIn(BaseModel):
    question: str = Field(min_length=3, max_length=600)
    lang: str = Field(default="ar", pattern="^(ar|en)$")
    history: list[dict] = Field(default_factory=list, max_length=6)  # last turns, for follow-up questions


def _access(ctx: Ctx) -> str:
    """'learner' | 'staff' | '' — who may ask right now."""
    s = get_settings()
    if not s.ai_api_key:
        return ""
    if ctx.can("preview"):
        return "staff"
    return "learner" if s.ai_enabled_for_learners else ""  # every signed-in user once switched on


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
    hits = knowledge.search(ctx.db, SLUG, body.question, k=5)
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
    key = (body.lang, " ".join(knowledge.tokens(body.question)))
    if not body.history and key in _answers:  # the same question (after normalisation) is answered once and reused: no new tokens
        return {"answer": _answers[key], "sources": uniq, "grounded": True, "fallback": False, "cached": True}
    try:
        answer = assistant.complete(assistant.build_messages(body.question, passages, body.lang, body.history))
        if len(_answers) > 500:
            _answers.clear()
        if not body.history:
            _answers[key] = answer
        return {"answer": answer, "sources": uniq, "grounded": True, "fallback": False}
    except assistant.ProviderError:
        # Graceful fallback: show the most relevant material instead of an answer.
        head = ("المساعد غير متاح الآن. هذه أقرب المقاطع من مواد الدورة لسؤالك:" if body.lang == "ar"
                else "The assistant is unavailable right now. These are the closest passages from the course material:")
        excerpts = [{"label": assistant.label(r.source, r.ref, body.lang), "title": r.title, "text": r.text[:600]} for _, r in hits[:3]]
        return {"answer": head, "sources": uniq, "grounded": True, "fallback": True, "excerpts": excerpts}
