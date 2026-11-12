"""Trial period: only allow-listed e-mails may sign in, keep a session, be invited or reset a password."""
import pytest

from app import mailer
from app.config import get_settings

from .conftest import Api, make_user, staff_login


@pytest.fixture()
def trial():
    s = get_settings()
    old = s.trial_emails
    def set_(emails: str):
        s.trial_emails = emails
    yield set_
    s.trial_emails = old


def test_only_allow_listed_emails_can_sign_in(trial):
    ok, other = make_user(), make_user()
    trial(f" {ok.email.upper()} , someone@example.org")  # case and spaces do not matter
    assert Api().login(ok.email).status_code == 200
    r = Api().login(other.email)
    assert r.status_code == 403 and r.json()["detail"]["code"] == "trial_only"


def test_existing_session_is_cut_when_removed_from_list(trial):
    u = make_user()
    a = Api()
    assert a.login(u.email).status_code == 200
    assert a.get("/api/auth/me").status_code == 200
    trial("someone.else@example.org")
    r = a.get("/api/auth/me")
    assert r.status_code == 401 and r.json()["detail"]["code"] == "trial_only"


def test_invites_and_resets_respect_the_list(trial):
    owner = make_user("owner")
    trial(f"{owner.email},invited.ok@example.org")
    a = Api()
    staff_login(a, owner)
    assert a.post("/api/admin/users/invite", {"email": "outsider@example.org", "name": "Out Sider", "role": "trainee"}).json()["detail"]["code"] == "trial_only"
    assert a.post("/api/admin/users/invite", {"email": "invited.ok@example.org", "name": "Invited Person", "role": "trainee"}).status_code == 200
    # Forgot-password answers the same for everyone but only mails allow-listed accounts.
    blocked = make_user()
    sent = len(mailer.OUTBOX)
    assert Api().post("/api/auth/forgot", {"email": blocked.email}).json() == {"ok": True}
    assert len(mailer.OUTBOX) == sent


def test_public_config_reports_trial_without_leaking_emails(trial):
    assert Api().get("/api/public/config").json() == {"trial": False}
    trial("secret.person@example.org")
    r = Api().get("/api/public/config")
    assert r.json() == {"trial": True} and "secret.person" not in r.text
