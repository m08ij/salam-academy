import json

from sqlalchemy import select

from app.models import Program

from .conftest import Api


def test_overview_is_public_and_leaks_nothing_private(db):
    r = Api().get("/api/public/overview")  # no session at all
    assert r.status_code == 200
    d = r.json()
    assert d["stats"]["groups"] == 12 and d["stats"]["values"] > 0 and d["stats"]["behaviors"] > 0
    assert len(d["groups"]) == 12 and len(d["programs"]) == 10 and d["books"] and d["framework"]["concepts"]
    lv = d["academy"][0]["levels"][0]
    assert lv["lessons"] > 0 and lv["courses"]
    body = json.dumps(d, ensure_ascii=False)
    # Lesson bodies, quiz questions/answers and user data must never be exposed here.
    for forbidden in ('"correct"', '"options"', '"body_ar"', '"email"', '"password', '"questions"'):
        assert forbidden not in body, forbidden


def test_overview_hides_inactive_programs(db):
    p = db.scalar(select(Program).where(Program.slug == "best-version"))
    p.active = False
    db.commit()
    try:
        assert Api().get("/api/public/overview").json()["academy"] == []
    finally:
        p.active = True
        db.commit()
