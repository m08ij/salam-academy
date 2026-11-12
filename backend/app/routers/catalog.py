"""Read-only Salam values catalog: groups of the Beautiful Names, values with their scales, and behaviors."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select

from ..deps import Ctx, current
from ..models import CatBehavior, CatGroup, CatName, CatValue

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


def _b(b: CatBehavior) -> dict:
    return {"id": b.id, "value_id": b.value_id, "name_id": b.name_id, "group_id": b.group_id, "ar": b.text_ar, "en": b.text_en, "unofficial_en": b.unofficial_en}


@router.get("/groups")
def groups(ctx: Ctx = Depends(current)):
    names = ctx.db.scalars(select(CatName)).all()
    return [{"id": g.id, "position": g.position, "title_ar": g.title_ar, "title_en": g.title_en, "desc_ar": g.desc_ar, "desc_en": g.desc_en, "color": g.color, "skills": g.skills,
             "names": [{"id": n.id, "ar": n.title_ar, "en": n.title_en} for n in names if n.group_id == g.id]}
            for g in ctx.db.scalars(select(CatGroup).order_by(CatGroup.position))]


@router.get("/values")
def values(relation: int | None = Query(default=None, ge=1, le=3), ctx: Ctx = Depends(current)):
    q = select(CatValue).order_by(CatValue.id)
    if relation:
        q = q.where(CatValue.relation == relation)
    return [{"id": v.id, "relation": v.relation, "family": v.family, "title_ar": v.title_ar, "title_en": v.title_en} for v in ctx.db.scalars(q)]


@router.get("/values/{vid}")
def value(vid: int, ctx: Ctx = Depends(current)):
    v = ctx.db.get(CatValue, vid)
    if not v:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    siblings = ctx.db.scalars(select(CatValue).where(CatValue.family == v.family, CatValue.id != v.id)).all()
    return {"id": v.id, "relation": v.relation, "title_ar": v.title_ar, "title_en": v.title_en, "scale": v.scale,
            "siblings": [{"id": s.id, "relation": s.relation, "title_ar": s.title_ar, "title_en": s.title_en} for s in siblings],
            "behaviors": [_b(b) for b in ctx.db.scalars(select(CatBehavior).where(CatBehavior.value_id == v.id).order_by(CatBehavior.group_id, CatBehavior.name_id))]}


@router.get("/names/{nid}")
def name(nid: int, ctx: Ctx = Depends(current)):
    n = ctx.db.get(CatName, nid)
    if not n:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    return {"id": n.id, "ar": n.title_ar, "en": n.title_en, "group_id": n.group_id,
            "behaviors": [_b(b) for b in ctx.db.scalars(select(CatBehavior).where(CatBehavior.name_id == n.id).order_by(CatBehavior.value_id))]}


@router.get("/search")
def search(q: str = Query(min_length=2, max_length=80), ctx: Ctx = Depends(current)):
    like = f"%{q}%"
    vals = ctx.db.scalars(select(CatValue).where(or_(CatValue.title_ar.ilike(like), CatValue.title_en.ilike(like))).limit(20)).all()
    behs = ctx.db.scalars(select(CatBehavior).where(or_(CatBehavior.text_ar.ilike(like), CatBehavior.text_en.ilike(like))).limit(40)).all()
    return {"values": [{"id": v.id, "relation": v.relation, "title_ar": v.title_ar, "title_en": v.title_en} for v in vals], "behaviors": [_b(b) for b in behs]}


@router.get("/behaviors")
def behaviors_by_id(ids: str = Query(max_length=2000), ctx: Ctx = Depends(current)):
    wanted = [int(x) for x in ids.split(",") if x.strip().isdigit()][:200]
    return [_b(b) for b in ctx.db.scalars(select(CatBehavior).where(CatBehavior.id.in_(wanted)))] if wanted else []
