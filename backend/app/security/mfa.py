"""TOTP (RFC 6238) with encrypted secrets, replay protection and single-use recovery codes."""
import secrets
import time

import pyotp
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import utcnow
from ..models import RecoveryCode, User
from .tokens import digest

ISSUER = "Salam Academy"


def _f() -> Fernet:
    return Fernet(get_settings().mfa_encryption_key.encode())


def encrypt(secret: str) -> str:
    return _f().encrypt(secret.encode()).decode()


def decrypt(blob: str) -> str | None:
    try:
        return _f().decrypt(blob.encode()).decode()
    except (InvalidToken, ValueError):
        return None


def new_secret() -> str:
    return pyotp.random_base32(32)


def provisioning_uri(secret: str, email: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=ISSUER)


def verify_totp(user: User, secret: str, code: str) -> bool:
    """Accepts the current step ±1 and rejects re-use of an already accepted step."""
    code = "".join(ch for ch in code if ch.isdigit())
    if len(code) != 6:
        return False
    totp = pyotp.TOTP(secret)
    now_step = int(time.time()) // 30
    for step in (now_step - 1, now_step, now_step + 1):
        if secrets.compare_digest(totp.at(step * 30), code):
            if user.mfa_last_step is not None and step <= user.mfa_last_step:
                return False
            user.mfa_last_step = step
            return True
    return False


def new_recovery_codes(db: Session, user: User, n: int = 10) -> list[str]:
    for rc in db.scalars(select(RecoveryCode).where(RecoveryCode.user_id == user.id)):
        db.delete(rc)
    codes = []
    for _ in range(n):
        raw = secrets.token_hex(5).upper()  # 40 bits each, single use
        code = f"{raw[:5]}-{raw[5:]}"
        codes.append(code)
        db.add(RecoveryCode(user_id=user.id, code_hash=digest(code)))
    return codes


def use_recovery_code(db: Session, user: User, code: str) -> bool:
    norm = code.strip().upper()
    if len(norm) == 10 and "-" not in norm:
        norm = f"{norm[:5]}-{norm[5:]}"
    rc = db.scalar(select(RecoveryCode).where(RecoveryCode.user_id == user.id, RecoveryCode.code_hash == digest(norm), RecoveryCode.used_at.is_(None)))
    if not rc:
        return False
    rc.used_at = utcnow()
    return True
