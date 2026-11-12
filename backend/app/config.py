"""Runtime configuration. Every secret comes from the environment; nothing sensitive is hard-coded."""
from functools import lru_cache

from pydantic import AliasChoices, Field, field_validator
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
    # Without an e-mail service (e.g. a free trial host), show invite links to the inviting admin so they can share them.
    # Only takes effect while no SMTP host is configured.
    show_invite_links: bool = False
    # First owner, created once at start-up when no owner exists (python -m app.cli bootstrap). Must change the password on first sign-in.
    owner_email: str = ""
    owner_name: str = ""
    owner_password: str = ""
    # Trial only: "email|name|role|password;..." accounts created at start-up if missing (ready to sign in).
    trial_users: str = ""

    # Course assistant (OpenAI-compatible chat API; OpenRouter by default). The key never leaves the server.
    ai_api_key: str = Field(default="", validation_alias=AliasChoices("SALAM_AI_API_KEY", "OPENROUTER_API_KEY"))
    ai_base_url: str = "https://openrouter.ai/api/v1"
    ai_model: str = "baidu/ernie-5.5-flash-preview:free"
    ai_fallback_models: str = "nvidia/nemotron-3.5-lightning:free,nvidia/nemotron-3-ultra-550b-a55b:free"  # free only, in order
    ai_enabled_for_learners: bool = True  # every signed-in user may ask; set false to limit it to staff
    ai_daily_limit: int = 20  # questions per person per day
    ai_timeout_seconds: int = 45

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

    @property
    def share_invite_links(self) -> bool:
        return self.environment == "development" or (self.show_invite_links and not self.smtp_host)

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
