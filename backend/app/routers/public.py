"""Public, unauthenticated overview for the landing page.

Only published reference material is exposed here: the Salam system's shape (groups, counts), the published
program descriptions, the library, and the structure of *active* academy programs. No user data, no lesson bodies,
no quiz questions or answers.
"""
from functools import lru_cache

from fastapi import APIRouter, Depends, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session as DB

from ..config import get_settings
from ..db import get_db
from ..models import CatBehavior, CatGroup, CatName, CatValue, Program
from ..seed.seed import load

router = APIRouter(prefix="/api/public", tags=["public"])


@lru_cache(maxsize=1)
def _payload_public() -> dict:
    D = load()
    fw = D["fw"]
    return {
        "framework": {"title": fw["title"], "intro": fw["intro"], "concepts": [{"t": [c[0], c[1]], "d": [c[2], c[3]]} for c in fw["concepts"]]},
        "programs": [{"id": p["id"], "t": p["t"], "aud": p["aud"], "dur": p.get("dur"), "d": p["d"], "out": p.get("out", [])[:4], "url": p.get("url", "")} for p in D["programs"]],
        "books": [{"t": b["t"], "d": b.get("d", ["", ""]), "u": b.get("u", "")} for b in D["books"]],
        "lectures": [{"t": x["t"], "u": x["u"]} for x in D["lectures"]],
    }


@router.get("/overview")
def overview(response: Response, db: DB = Depends(get_db)):
    names = db.scalars(select(CatName)).all()
    rel_counts = dict(db.execute(select(CatValue.relation, func.count()).group_by(CatValue.relation)).all())
    groups = [{"id": g.id, "position": g.position, "t": [g.title_ar, g.title_en], "d": [g.desc_ar, g.desc_en], "color": g.color, "skills": g.skills,
               "names": [[n.title_ar, n.title_en] for n in names if n.group_id == g.id]}
              for g in db.scalars(select(CatGroup).order_by(CatGroup.position))]
    academy = [{"slug": p.slug, "self_paced": p.self_paced, "t": [p.title_ar, p.title_en], "d": [p.desc_ar, p.desc_en],
                "levels": [{"position": lv.position, "t": [lv.title_ar, lv.title_en], "d": [lv.desc_ar, lv.desc_en],
                            # [title_ar, title_en, lesson count, lesson titles] — titles only, never lesson bodies or questions
                            "courses": [[c.title_ar, c.title_en, len(c.lessons), [[ls.title_ar, ls.title_en] for ls in c.lessons]] for c in lv.courses],
                            "lessons": sum(len(c.lessons) for c in lv.courses), "hours": sum(ls.hours for c in lv.courses for ls in c.lessons),
                            "project": [lv.project_title_ar, lv.project_title_en] if lv.project_required else None} for lv in p.levels]}
               for p in db.scalars(select(Program).where(Program.active.is_(True)).order_by(Program.slug))]
    stats = {"relations": len(rel_counts) or 3, "groups": len(groups), "names": len(names),
             "values": db.scalar(select(func.count()).select_from(CatValue)) or 0, "behaviors": db.scalar(select(func.count()).select_from(CatBehavior)) or 0}
    response.headers["Cache-Control"] = "public, max-age=300"
    return {"stats": stats, "relations": {str(k): v for k, v in rel_counts.items()}, "groups": groups, "academy": academy, **_payload_public()}


@router.get("/config")
def config():
    """What the sign-in page needs to know. The allow-list itself is never published."""
    s = get_settings()
    return {"trial": bool(s.trial_emails.strip()), "password_min": s.password_min_length}


@router.get("/preview")
def preview(db: DB = Depends(get_db)):
    """The Identity course's welcome section, readable without an account (a free sample)."""
    from ..models import Program
    from ..services.progress import level_lessons
    p = db.scalar(select(Program).where(Program.slug == "identity"))
    ls = [x for lv in (p.levels if p else []) for x in level_lessons(lv)]
    x = ls[1] if len(ls) > 1 else None
    return {"title": x.title_ar, "body": x.body_ar, "sections": len(ls) - 1} if x else {}
