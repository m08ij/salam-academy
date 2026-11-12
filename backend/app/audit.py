from fastapi import Request
from sqlalchemy.orm import Session

from .models import AuditLog, User
from .security.sessions import client_ip


def log(db: Session, action: str, actor: User | None = None, request: Request | None = None,
        target_type: str | None = None, target_id=None, **detail) -> None:
    """Append-only security and training audit trail. Never store secrets, passwords or tokens here."""
    db.add(AuditLog(actor_id=actor.id if actor else None, actor_role=actor.role if actor else None, action=action,
                    target_type=target_type, target_id=str(target_id) if target_id is not None else None,
                    ip=client_ip(request) if request else None, detail={k: v for k, v in detail.items() if v is not None}))
