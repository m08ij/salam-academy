from app.services import assistant
from .test_identity import _enrolled_learner, _owner_api


def test_glossary_quizzes_comments_insights(db, monkeypatch):
    t, eid, p = _enrolled_learner(db)
    a = _owner_api()
    monkeypatch.setattr(assistant, "complete", lambda m: '[{"q":"س","options":["أ","ب","ج","د"],"correct":1}]' if "JSON" in m[0]["content"] else "تعريف.")
    assert a.post("/api/admin/content/identity/generate", {"kind": "glossary", "limit": 6}).status_code == 200
    assert t.get("/api/learn/glossary").json()
    assert a.post("/api/admin/content/identity/generate", {"kind": "quizzes"}).status_code == 200
    assert a.get("/api/admin/insights").json()["enrolled"] == 1
    lid = str(p.levels[0].courses[0].lessons[0].id)
    assert a.post(f"/api/training/enrollments/{eid}/lessons/{lid}/comment", {"text": "أحسنت"}).status_code == 200
    assert t.get(f"/api/learn/enrollments/{eid}/lessons/{lid}").json()["trainer_notes"][0]["text"] == "أحسنت"
