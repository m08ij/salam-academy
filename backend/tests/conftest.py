import os
import sys
from pathlib import Path

import pytest
from cryptography.fernet import Fernet

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.update({
    "SALAM_ENVIRONMENT": "test", "SALAM_DATABASE_URL": os.environ.get("SALAM_TEST_DATABASE_URL", f"sqlite:///{ROOT / 'test.db'}"), "SALAM_MFA_ENCRYPTION_KEY": Fernet.generate_key().decode(),
    "SALAM_APP_URL": "http://web.test", "SALAM_COOKIE_SECURE": "false", "SALAM_SMTP_HOST": "", "SALAM_REQUIRE_STAFF_MFA": "true", "SALAM_TRIAL_EMAILS": "", "SALAM_ALLOW_SIGNUP": "false", "SALAM_HIBP_CHECK": "false",
})

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app import mailer  # noqa: E402
from app.db import Base, engine, reset_engine, session_scope, utcnow  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models import User  # noqa: E402
from app.security.passwords import hash_password  # noqa: E402
from app.seed.seed import run as seed_run  # noqa: E402

PW = "a-long-Unique passphrase 42"


@pytest.fixture(scope="session", autouse=True)
def _db():
    db_file = ROOT / "test.db"
    if db_file.exists():
        db_file.unlink()
    reset_engine()
    Base.metadata.drop_all(engine())
    Base.metadata.create_all(engine())
    s = session_scope()
    seed_run(s)
    s.close()
    yield
    Base.metadata.drop_all(engine())
    reset_engine()
    db_file.unlink(missing_ok=True)


@pytest.fixture()
def db():
    s = session_scope()
    yield s
    s.close()


class Api:
    """Browser-like client: sends Origin, and echoes the CSRF cookie in X-CSRF-Token."""

    def __init__(self):
        self.c = TestClient(create_app(), base_url="http://web.test")
        self.c.headers["origin"] = "http://web.test"

    def _h(self):
        t = self.c.cookies.get("salam_csrf")
        return {"x-csrf-token": t} if t else {}

    def get(self, url, **kw):
        return self.c.get(url, **kw)

    def post(self, url, json=None, **kw):
        return self.c.post(url, json=json, headers=self._h() | kw.pop("headers", {}), **kw)

    def put(self, url, json=None, **kw):
        return self.c.put(url, json=json, headers=self._h() | kw.pop("headers", {}), **kw)

    def patch(self, url, json=None, **kw):
        return self.c.patch(url, json=json, headers=self._h() | kw.pop("headers", {}), **kw)

    def delete(self, url, **kw):
        return self.c.delete(url, headers=self._h() | kw.pop("headers", {}), **kw)

    def login(self, email, password=PW):
        return self.post("/api/auth/login", {"email": email, "password": password})


_n = {"i": 0}


def make_user(role="trainee", email=None, mfa=False, password=PW, name=None) -> User:
    _n["i"] += 1
    s = session_scope()
    u = User(email=email or f"{role}{_n['i']}@example.org", name=name or f"{role.title()} Person {_n['i']}", role=role, status="active",
             password_hash=hash_password(password), password_changed_at=utcnow(), email_verified_at=utcnow())
    s.add(u)
    s.commit()
    s.refresh(u)
    s.close()
    return u


@pytest.fixture()
def api():
    return Api()


@pytest.fixture(autouse=True)
def _clear_outbox():
    mailer.OUTBOX.clear()
    from app.db import session_scope as ss
    from app.models import RateEvent
    s = ss()
    s.query(RateEvent).delete()
    s.commit()
    s.close()
    yield


def staff_login(api: Api, user: User):
    """Signs in a staff user and completes the mandatory MFA set-up. Returns the TOTP secret."""
    import pyotp
    r = api.login(user.email)
    assert r.status_code == 200, r.text
    if r.json()["mfa_setup_required"]:
        sec = api.post("/api/me/mfa/setup").json()["secret"]
        r2 = api.post("/api/me/mfa/confirm", {"code": pyotp.TOTP(sec).now()})
        assert r2.status_code == 200, r2.text
        return sec
    return None


def user_by_email(email):
    s = session_scope()
    u = s.scalar(select(User).where(User.email == email))
    s.close()
    return u
