"""Hosting helpers: first-owner bootstrap and shareable invite links on hosts without e-mail."""
import pytest
from sqlalchemy import select, update

from app.cli import bootstrap
from app.config import get_settings
from app.db import session_scope
from app.models import User

from .conftest import PW, Api, make_user, staff_login


@pytest.fixture()
def settings():
    s = get_settings()
    saved = {k: getattr(s, k) for k in ("owner_email", "owner_name", "owner_password", "show_invite_links", "smtp_host", "environment")}
    yield s
    for k, v in saved.items():
        setattr(s, k, v)


def _hide_owners():
    """Other tests create owners; park them so bootstrap sees an owner-less platform."""
    db = session_scope()
    ids = [u.id for u in db.scalars(select(User).where(User.role == "owner"))]
    db.execute(update(User).where(User.id.in_(ids)).values(status="deleted"))
    db.commit()
    db.close()
    return ids


def _restore(ids):
    db = session_scope()
    db.execute(update(User).where(User.id.in_(ids)).values(status="active"))
    db.commit()
    db.close()


def test_bootstrap_creates_first_owner_once(settings):
    ids = _hide_owners()
    try:
        settings.owner_email, settings.owner_name, settings.owner_password = "First.Owner@Example.org", "First Owner", PW
        bootstrap()
        db = session_scope()
        u = db.scalar(select(User).where(User.email == "first.owner@example.org"))
        assert u and u.role == "owner" and u.status == "active" and u.must_change_password
        db.close()
        r = Api().login("first.owner@example.org")
        assert r.status_code == 200 and r.json()["must_change_password"] is True
        # A second run (every container start) must not touch the account.
        settings.owner_password = "another long passphrase 77"
        bootstrap()
        assert Api().login("first.owner@example.org").status_code == 200
    finally:
        _restore(ids)


def test_bootstrap_rejects_weak_password(settings, capsys):
    ids = _hide_owners()
    try:
        settings.owner_email, settings.owner_password = "weak.owner@example.org", "short"
        bootstrap()
        assert "rejected" in capsys.readouterr().out
        db = session_scope()
        assert db.scalar(select(User).where(User.email == "weak.owner@example.org")) is None
        db.close()
    finally:
        _restore(ids)


def test_invite_link_shared_only_without_smtp(settings):
    owner = make_user("owner")
    a = Api()
    staff_login(a, owner)
    settings.environment, settings.show_invite_links, settings.smtp_host = "production", True, ""
    r = a.post("/api/admin/users/invite", {"email": "share.me@example.org", "name": "Share Me", "role": "trainee"}).json()
    assert r["invite_link"].startswith("http://web.test/accept-invite?token=")
    settings.smtp_host = "smtp.example.org"  # with e-mail delivery configured, links are never returned
    r = a.post(f"/api/admin/users/{r['id']}/resend-invite").json()
    assert "invite_link" not in r
    settings.smtp_host, settings.show_invite_links = "", False
    r = a.post("/api/admin/users/invite", {"email": "no.share@example.org", "name": "No Share", "role": "trainee"}).json()
    assert "invite_link" not in r
