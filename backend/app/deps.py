from collections.abc import Callable
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session as DB

from .config import get_settings
from .db import get_db
from .models import Session, User
from .permissions import has
from .security import sessions
from .security.tokens import digest, same


@dataclass
class Ctx:
    user: User
    session: Session
    db: DB

    def can(self, perm: str) -> bool:
        return has(self.user.role, perm)


def _check_csrf(request: Request, sess: Session) -> None:
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    tok = request.headers.get("x-csrf-token", "")
    if not tok or not same(digest(tok), sess.csrf_hash):
        raise HTTPException(status_code=403, detail={"code": "csrf"})


def _ctx(request: Request, db: DB, allow_pending: bool) -> Ctx:
    sess = sessions.lookup(db, request)
    if not sess:
        raise HTTPException(status_code=401, detail={"code": "unauthenticated"})
    _check_csrf(request, sess)
    if not get_settings().trial_allowed(sess.user.email):
        raise HTTPException(status_code=401, detail={"code": "trial_only"})
    if not sess.mfa_passed and not allow_pending:
        raise HTTPException(status_code=401, detail={"code": "mfa_required"})
    if sess.user.must_change_password and not allow_pending and request.url.path not in ("/api/me/password",):
        raise HTTPException(status_code=403, detail={"code": "password_change_required"})
    return Ctx(user=sess.user, session=sess, db=db)


def current(request: Request, db: DB = Depends(get_db)) -> Ctx:
    return _ctx(request, db, allow_pending=False)


def current_pending(request: Request, db: DB = Depends(get_db)) -> Ctx:
    """For the few endpoints usable before MFA is completed or set up (finish MFA, set up MFA, sign out, read own profile)."""
    return _ctx(request, db, allow_pending=True)


def require(*perms: str) -> Callable[[Ctx], Ctx]:
    def dep(ctx: Ctx = Depends(current)) -> Ctx:
        if not any(ctx.can(p) for p in perms):
            raise HTTPException(status_code=403, detail={"code": "forbidden"})
        return ctx
    return dep
