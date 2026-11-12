import hashlib
import hmac
import secrets


def new_token(nbytes: int = 32) -> str:
    """URL-safe random token with 256 bits of entropy by default."""
    return secrets.token_urlsafe(nbytes)


def digest(token: str) -> str:
    """Tokens are high-entropy, so a fast SHA-256 digest is the right storage form (never store the raw token)."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def same(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())
