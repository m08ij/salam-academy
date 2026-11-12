"""Sliding-window rate limits stored in the database (works across several API replicas without extra services)."""
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..db import utcnow
from ..models import RateEvent


def hit(db: Session, key: str, limit: int, window_s: int) -> None:
    now = utcnow()
    since = now - timedelta(seconds=window_s)
    n = db.scalar(select(func.count()).select_from(RateEvent).where(RateEvent.key == key, RateEvent.ts > since)) or 0
    if n >= limit:
        raise HTTPException(status_code=429, detail={"code": "rate_limited", "retry_after": window_s})
    db.add(RateEvent(key=key, ts=now))
    db.commit()


def prune(db: Session, older_than_s: int = 86400) -> None:
    db.execute(delete(RateEvent).where(RateEvent.ts < utcnow() - timedelta(seconds=older_than_s)))
    db.commit()


def count(db: Session, key: str, window_s: int) -> int:
    since = utcnow() - timedelta(seconds=window_s)
    return db.scalar(select(func.count()).select_from(RateEvent).where(RateEvent.key == key, RateEvent.ts > since)) or 0
