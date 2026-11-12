"""Server-side sessions: an opaque random cookie, stored only as a SHA-256 digest; idle and absolute expiry; CSRF bound to the session."""
from datetime import timedelta

from fastapi import Request, Response
from sqlalchemy import select, update
from sqlalchemy.orm import Session as DB

from ..config import get_settings
from ..db import utcnow
from ..models import Session, User
from .tokens import digest, new_token

COOKIE = "salam_session"
CSRF_COOKIE = "salam_csrf"


def client_ip(request: Request) -> str:
    # Behind the bundled reverse proxy the real address arrives in X-Forwarded-For (first hop is trusted).
    fwd = request.headers.get("x-forwarded-for")
    return (fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else ""))[:64]


def create(db: DB, user: User, request: Request, response: Response, mfa_passed: bool) -> Session:
    s = get_settings()
    raw, csrf = new_token(), new_token()
    sess = Session(user_id=user.id, token_hash=digest(raw), csrf_hash=digest(csrf), mfa_passed=mfa_passed,
                   expires_at=utcnow() + timedelta(hours=s.session_absolute_hours), ip=client_ip(request),
                   user_agent=(request.headers.get("user-agent") or "")[:300])
    db.add(sess)
    _set_cookies(response, raw, csrf)
    return sess


def _set_cookies(response: Response, raw: str, csrf: str) -> None:
    s = get_settings()
    common = dict(secure=s.cookie_secure, samesite="lax", domain=s.cookie_domain, path="/")
    response.set_cookie(COOKIE, raw, httponly=True, max_age=s.session_absolute_hours * 3600, **common)
    # Readable by the web app so it can echo it in the X-CSRF-Token header (double submit, bound to the session).
    response.set_cookie(CSRF_COOKIE, csrf, httponly=False, max_age=s.session_absolute_hours * 3600, **common)


def clear_cookies(response: Response) -> None:
    s = get_settings()
    for c in (COOKIE, CSRF_COOKIE):
        response.delete_cookie(c, path="/", domain=s.cookie_domain)


def lookup(db: DB, request: Request) -> Session | None:
    raw = request.cookies.get(COOKIE)
    if not raw:
        return None
    sess = db.scalar(select(Session).where(Session.token_hash == digest(raw)))
    if not sess or sess.revoked_at is not None:
        return None
    now = utcnow()
    idle = timedelta(minutes=get_settings().session_idle_minutes)
    if sess.expires_at <= now or sess.last_seen_at + idle <= now:
        sess.revoked_at = now
        db.commit()
        return None
    if sess.user.status != "active":
        return None
    if (now - sess.last_seen_at).total_seconds() > 60:
        sess.last_seen_at = now
        db.commit()
    return sess


def rotate(db: DB, sess: Session, response: Response) -> None:
    """New identifiers after a privilege change (e.g. passing MFA) to prevent session fixation."""
    raw, csrf = new_token(), new_token()
    sess.token_hash, sess.csrf_hash = digest(raw), digest(csrf)
    _set_cookies(response, raw, csrf)


def revoke_all(db: DB, user_id, except_id=None) -> int:
    q = update(Session).where(Session.user_id == user_id, Session.revoked_at.is_(None))
    if except_id is not None:
        q = q.where(Session.id != except_id)
    return db.execute(q.values(revoked_at=utcnow())).rowcount or 0
