"""Runtime configuration. Every secret comes from the environment; nothing sensitive is hard-coded."""
from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="SALAM_", extra="ignore")

    environment: str = "production"
    database_url: str = "postgresql+psycopg://salam:salam@db:5432/salam"
    # Public origin of the web app (used for links in e-mails and the Origin check).
    app_url: str = "http://localhost:3000"
    # Fernet key (32 url-safe base64 bytes) used to encrypt TOTP secrets at rest.
    mfa_encryption_key: str = Field(..., min_length=40)

    cookie_secure: bool = True
    cookie_domain: str | None = None
    session_idle_minutes: int = 30
    session_absolute_hours: int = 12

    require_staff_mfa: bool = True
    allow_signup: bool = False
    # Trial period: comma-separated e-mails that may sign in, accept invites or be invited. Empty = everyone.
    trial_emails: str = ""

    login_max_failures: int = 5
    lockout_minutes: int = 15
    reset_token_minutes: int = 30
    invite_token_hours: int = 72
    verify_token_hours: int = 48

    password_min_length: int = 12
    hibp_check: bool = False  # k-anonymity range query to api.pwnedpasswords.com

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "Salam Academy <no-reply@example.org>"
    smtp_starttls: bool = True

    def trial_allowed(self, email: str | None) -> bool:
        allowed = {e.strip().lower() for e in self.trial_emails.split(",") if e.strip()}
        return not allowed or (email or "").strip().lower() in allowed

    @field_validator("app_url")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.rstrip("/")


@lru_cache
def get_settings() -> Settings:
    return Settings()
