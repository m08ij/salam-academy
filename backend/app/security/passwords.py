"""Password hashing (Argon2id) and a NIST SP 800-63B style policy: length + block-list, no composition rules."""
import hashlib
import re

import httpx
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from ..config import get_settings

# OWASP 2024 baseline for Argon2id: m=19 MiB, t=2, p=1. We use a stronger profile.
_HASHER = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=2, hash_len=32, salt_len=16)
# Pre-computed hash used to equalise timing when an account does not exist.
_DUMMY = _HASHER.hash("timing-equaliser-not-a-real-password")

COMMON = {
    "password", "password1", "password123", "123456789012", "qwertyuiop", "1q2w3e4r5t6y", "iloveyou123",
    "admin123456", "welcome12345", "letmein12345", "abcdefghijkl", "aaaaaaaaaaaa", "000000000000",
    "111111111111", "123123123123", "qwerty123456", "salam1234567", "salamsalam12", "passw0rd1234",
    "football1234", "princess1234", "sunshine1234", "monkey123456", "dragon123456", "master123456",
    "baseball1234", "superman1234", "trustno11234", "starwars1234", "1234567890ab", "changeme1234",
}


# Words that stay weak however many digits or symbols are appended to them.
WEAK_WORDS = {"password", "passw0rd", "qwerty", "qwertyuiop", "admin", "administrator", "welcome", "letmein", "iloveyou", "salam",
              "football", "princess", "sunshine", "monkey", "dragon", "master", "baseball", "superman", "starwars", "changeme", "abc", "abcdef", "test", "user"}


def hash_password(pw: str) -> str:
    return _HASHER.hash(pw)


def verify_password(stored: str | None, pw: str) -> bool:
    if not stored:
        try:
            _HASHER.verify(_DUMMY, pw)
        except VerificationError:
            pass
        return False
    try:
        return _HASHER.verify(stored, pw)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(stored: str) -> bool:
    try:
        return _HASHER.check_needs_rehash(stored)
    except InvalidHashError:
        return True


def _pwned(pw: str) -> bool:
    sha = hashlib.sha1(pw.encode("utf-8")).hexdigest().upper()  # noqa: S324 - required by the HIBP k-anonymity API
    try:
        r = httpx.get(f"https://api.pwnedpasswords.com/range/{sha[:5]}", headers={"Add-Padding": "true"}, timeout=3)
        r.raise_for_status()
    except httpx.HTTPError:
        return False  # fail open: availability of a third party must not block sign-in flows
    return any(line.split(":")[0] == sha[5:] for line in r.text.splitlines())


def policy_errors(pw: str, email: str = "", name: str = "") -> list[str]:
    """Returns machine-readable error codes; the frontend localises them."""
    s = get_settings()
    errs: list[str] = []
    if len(pw) < s.password_min_length:
        errs.append("too_short")
    if len(pw) > 128:
        errs.append("too_long")
    low = pw.lower()
    core = re.sub(r"[\d\W_]+", "", low)
    if low in COMMON or core in WEAK_WORDS or len(set(low)) <= 3 or low.isdigit():
        errs.append("too_common")
    if re.search(r"(.)\1{3,}", pw):
        errs.append("repeated_chars")
    parts = [email.split("@")[0].lower()] + [p.lower() for p in re.split(r"\s+", name) if len(p) >= 4]
    if any(p and len(p) >= 4 and p in low for p in parts):
        errs.append("contains_personal_info")
    if not errs and s.hibp_check and _pwned(pw):
        errs.append("breached")
    return errs
