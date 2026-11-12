import time
from datetime import timedelta

import pyotp
from sqlalchemy import select

from app import mailer
from app.db import utcnow
from app.models import AuditLog, Session, User
from app.security.passwords import policy_errors

from .conftest import PW, Api, make_user, staff_login, user_by_email


def test_password_policy():
    assert "too_short" in policy_errors("short1")
    assert "too_common" in policy_errors("password1234")
    assert "contains_personal_info" in policy_errors("sarah.ahmed-loves-2026", email="sarah.ahmed@example.org")
    assert "repeated_chars" in policy_errors("aaaa-long-enough-passphrase")
    assert policy_errors(PW) == []


def test_login_generic_failure_and_lockout(api: Api, db):
    u = make_user()
    r = api.login("nobody@example.org")
    assert r.status_code == 401 and r.json()["detail"]["code"] == "invalid_credentials"
    for _ in range(5):
        assert api.login(u.email, "wrong password value").status_code == 401
    # locked: even the right password is refused, with the same generic answer
    r = api.login(u.email)
    assert r.status_code == 401 and r.json()["detail"]["code"] == "invalid_credentials"
    row = db.get(User, u.id)
    db.refresh(row)
    assert row.locked_until is not None
    assert db.scalar(select(AuditLog).where(AuditLog.action == "account_locked", AuditLog.target_id == str(u.id)))


def test_rate_limit(api: Api):
    u = make_user()
    codes = [api.login(u.email, "wrong but long password!").status_code for _ in range(11)]
    assert 429 in codes


def test_csrf_and_origin(api: Api):
    u = make_user()
    assert api.login(u.email).status_code == 200
    # missing CSRF header
    r = api.c.put("/api/me/privacy", json={"share_reflections": True, "share_plan": False})
    assert r.status_code == 403 and r.json()["detail"]["code"] == "csrf"
    # foreign origin
    r = api.c.put("/api/me/privacy", json={"share_reflections": True, "share_plan": False}, headers={"origin": "https://evil.example", "x-csrf-token": api.c.cookies.get("salam_csrf")})
    assert r.status_code == 403 and r.json()["detail"]["code"] == "bad_origin"
    assert api.put("/api/me/privacy", {"share_reflections": True, "share_plan": False}).status_code == 200


def test_session_cookie_flags_and_idle_expiry(api: Api, db):
    u = make_user()
    r = api.login(u.email)
    sc = r.headers.get_list("set-cookie")
    sess_cookie = next(c for c in sc if c.startswith("salam_session="))
    assert "HttpOnly" in sess_cookie and "SameSite=lax" in sess_cookie
    assert api.get("/api/me").status_code == 200
    s = db.scalar(select(Session).where(Session.user_id == u.id))
    s.last_seen_at = utcnow() - timedelta(minutes=31)
    db.commit()
    assert api.get("/api/me").status_code == 401


def test_forgot_and_reset_flow(api: Api):
    u = make_user()
    other = Api()
    assert other.login(u.email).status_code == 200
    assert api.post("/api/auth/forgot", {"email": "unknown@example.org"}).json() == {"ok": True}
    assert len(mailer.OUTBOX) == 0
    assert api.post("/api/auth/forgot", {"email": u.email}).json() == {"ok": True}
    body = mailer.OUTBOX[-1].get_content()
    token = body.split("token=")[1].split()[0]
    new_pw = "another-strong passphrase 77"
    assert api.post("/api/auth/reset", {"token": token, "password": "short"}).status_code == 422  # weak password does not burn the link
    assert api.post("/api/auth/reset", {"token": token, "password": new_pw}).status_code == 200
    assert api.post("/api/auth/reset", {"token": token, "password": new_pw}).status_code == 400
    assert other.get("/api/me").status_code == 401  # existing sessions revoked
    assert api.login(u.email, new_pw).status_code == 200


def test_invite_mfa_and_recovery(api: Api):
    owner = make_user("owner")
    staff_login(api, owner)
    r = api.post("/api/admin/users/invite", {"email": "new.trainer@example.org", "name": "Khaled Trainer", "role": "trainer"})
    assert r.status_code == 200, r.text
    token = mailer.OUTBOX[-1].get_content().split("token=")[1].split()[0]
    t = Api()
    assert t.login("new.trainer@example.org").status_code == 401  # not active yet
    assert t.post("/api/auth/accept-invite", {"token": token, "password": PW}).status_code == 200
    r = t.login("new.trainer@example.org")
    assert r.json()["mfa_setup_required"] is True
    assert t.get("/api/training/trainees").status_code == 401  # blocked until MFA is set up
    sec = t.post("/api/me/mfa/setup").json()["secret"]
    assert t.post("/api/me/mfa/confirm", {"code": "000000"}).status_code == 400
    codes = t.post("/api/me/mfa/confirm", {"code": pyotp.TOTP(sec).now()}).json()["recovery_codes"]
    assert len(codes) == 10
    assert t.get("/api/training/trainees").status_code == 200
    t.post("/api/auth/logout")
    # next sign-in requires the second factor
    t2 = Api()
    r = t2.login("new.trainer@example.org")
    assert r.json()["mfa_required"] is True
    assert t2.get("/api/training/trainees").status_code == 401
    assert t2.post("/api/auth/mfa", {"code": "123456"}).status_code == 401
    assert t2.post("/api/auth/mfa", {"recovery_code": codes[0]}).status_code == 200
    assert t2.get("/api/training/trainees").status_code == 200
    # a recovery code works once
    t3 = Api()
    t3.login("new.trainer@example.org")
    assert t3.post("/api/auth/mfa", {"recovery_code": codes[0]}).status_code == 401
    # TOTP replay protection: a code accepted once cannot be reused
    time.sleep(0)  # same 30 s step
    t4, t5 = Api(), Api()
    t4.login("new.trainer@example.org")
    t5.login("new.trainer@example.org")
    code = pyotp.TOTP(sec).now()
    first = t4.post("/api/auth/mfa", {"code": code}).status_code
    second = t5.post("/api/auth/mfa", {"code": code}).status_code
    assert first in (200, 401) and second == 401
    # staff cannot switch MFA off
    assert t2.post("/api/me/mfa/disable", {"password": PW, "code": "000000"}).status_code == 403


def test_password_change_revokes_other_sessions(api: Api):
    u = make_user()
    other = Api()
    api.login(u.email)
    other.login(u.email)
    assert api.post("/api/me/password", {"current": "wrong", "new": "brand-new passphrase 2026!"}).status_code == 401
    assert api.post("/api/me/password", {"current": PW, "new": "short"}).status_code == 422
    r = api.post("/api/me/password", {"current": PW, "new": "brand-new passphrase 2026!"})
    assert r.status_code == 200 and r.json()["other_sessions_revoked"] >= 1
    assert other.get("/api/me").status_code == 401
    assert api.get("/api/me").status_code == 200


def test_signup_disabled_by_default(api: Api):
    assert api.post("/api/auth/signup", {"email": "x@example.org", "name": "X Person", "password": PW}).status_code == 404


def test_suspended_user_is_signed_out(api: Api):
    owner = make_user("owner")
    staff_login(api, owner)
    u = make_user()
    t = Api()
    t.login(u.email)
    assert t.get("/api/me").status_code == 200
    assert api.patch(f"/api/admin/users/{u.id}", {"status": "suspended"}).status_code == 200
    assert t.get("/api/me").status_code == 401
    assert Api().login(u.email).status_code == 401
    assert user_by_email(u.email).status == "suspended"
