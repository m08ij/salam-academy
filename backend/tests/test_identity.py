"""Identity course: content import, self-paced completion, final exam, and the course assistant."""
import pytest
from sqlalchemy import select

from app.config import get_settings
from app.models import Enrollment, Lesson, Program
from app.services import assistant, knowledge

from .conftest import Api, make_user, staff_login

EXAM_N = 12


def bundle(version: str = "v1") -> dict:
    lessons = [{"n": n, "title": f"القسم {n}", "body": f"نص القسم {n} ({version}).\n\nالهوية هي ما يعتقده ويقوله الآخرون عنك، والعلامة الشخصية وعود ثابتة."}
               for n in range(1, 24)]
    lessons[3]["body"] = "العلامة الشخصية: وعود وملامح قوية وثابتة يمكن توقعها دومًا عن الشخص. Consistent promises consistently delivered."
    exam = [{"q": f"سؤال {i}:", "options": ["أ", "ب", "ج", "د"], "correct": i % 4} for i in range(EXAM_N)]
    book = [{"page": 42, "text": "منظومة القيم هي نظام التشغيل للهوية؛ فالقيم تحدد السلوك وتصنع العلامة الشخصية لدى الإنسان " * 3},
            {"page": 1, "text": "غلاف"}]
    return {"lessons": lessons, "exam": exam, "book": book}


@pytest.fixture()
def ai():
    s = get_settings()
    saved = (s.ai_api_key, s.ai_enabled_for_learners, s.ai_daily_limit)
    yield s
    s.ai_api_key, s.ai_enabled_for_learners, s.ai_daily_limit = saved


def _owner_api():
    a = Api()
    staff_login(a, make_user("owner"))
    return a


def _import(a: Api, version="v1"):
    r = a.post("/api/admin/content/identity", bundle(version))
    assert r.status_code == 200, r.text
    return r.json()


def test_import_is_staff_only_and_idempotent(db):
    t = Api()
    t.login(make_user().email)
    assert t.post("/api/admin/content/identity", bundle()).status_code == 403
    a = _owner_api()
    first = _import(a)
    assert first["lessons"] == 23 and first["exam_questions"] == EXAM_N and first["knowledge_chunks"] > 23
    p = db.scalar(select(Program).where(Program.slug == "identity"))
    ids_before = sorted(str(ls.id) for c in p.levels[0].courses for ls in c.lessons)
    assert len(ids_before) == 24  # 23 sections + final exam
    second = _import(a, "v2")
    assert second["created"] is False
    db.expire_all()
    p = db.scalar(select(Program).where(Program.slug == "identity"))
    lessons = [ls for c in p.levels[0].courses for ls in c.lessons]
    assert sorted(str(ls.id) for ls in lessons) == ids_before  # same rows: learner progress survives re-imports
    assert any("(v2)" in ls.body_ar for ls in lessons)
    assert p.self_paced and a.get("/api/admin/content/identity/status").json()["lessons"] == 24


def _enrolled_learner(db):
    a = _owner_api()
    _import(a)
    p = db.scalar(select(Program).where(Program.slug == "identity"))
    u = make_user()
    e = a.post("/api/admin/enrollments", {"user_id": str(u.id), "program_id": str(p.id)}).json()
    t = Api()
    t.login(u.email)
    return t, e["id"], p


def test_self_paced_course_completes_after_final_exam(db):
    t, eid, p = _enrolled_learner(db)
    lessons = [ls for c in p.levels[0].courses for ls in c.lessons]
    exam = next(ls for ls in lessons if ls.questions)
    correct = [q.correct for q in exam.questions]
    for ls in lessons:
        if ls.id != exam.id:
            assert t.post(f"/api/learn/enrollments/{eid}/lessons/{ls.id}/complete").json()["completed_course"] is False
    # Exam: 8/12 is below 70% → cannot complete; answers are not revealed per question for long exams.
    wrong = [(c + 1) % 4 if i < 4 else c for i, c in enumerate(correct)]
    r = t.post(f"/api/learn/enrollments/{eid}/lessons/{exam.id}/quiz", {"answers": wrong}).json()
    assert r["score"] == 8 and r["passed"] is False and r["right"] is None
    assert t.post(f"/api/learn/enrollments/{eid}/lessons/{exam.id}/complete").status_code == 409
    r = t.post(f"/api/learn/enrollments/{eid}/lessons/{exam.id}/quiz", {"answers": correct}).json()
    assert r["passed"] is True
    assert t.post(f"/api/learn/enrollments/{eid}/lessons/{exam.id}/complete").json()["completed_course"] is True
    db.expire_all()
    assert db.get(Enrollment, __import__("uuid").UUID(eid)).graduated_at is not None
    st = t.get(f"/api/learn/enrollments/{eid}/journey").json()["stats"]
    assert st["graduated"] and not any(c["key"] == "eval" for c in st["checks"])


def test_knowledge_search_handles_arabic_forms():
    assert knowledge.tokens("الهُويَّة") == knowledge.tokens("الهوية")
    assert knowledge.normalize("إيمان") == knowledge.normalize("ايمان")
    chunks = knowledge.chunk_lessons([(3, "من أنت؟", "الهوية هي ما يقوله الآخرون عنك.")]) + knowledge.chunk_pages([(9, "x"), (42, "منظومة القيم نظام تشغيل الهوية " * 4)])
    assert [c[0] for c in chunks] == ["lesson", "book"]  # page 9 too short (covers, blanks)


def test_assistant_access_answers_fallback_and_limits(db, ai, monkeypatch):
    t, eid, p = _enrolled_learner(db)
    ai.ai_api_key, ai.ai_enabled_for_learners, ai.ai_daily_limit = "", False, 2
    assert t.get("/api/assistant/status").json()["available"] is False
    ai.ai_api_key = "test-key"
    assert t.post("/api/assistant/ask", {"question": "ما هي الهوية؟"}).status_code == 403  # staff-only testing phase
    staff = _owner_api()
    seen = {}

    def fake_complete(messages):
        seen["messages"] = messages
        return "الهوية هي ما يقوله الآخرون عنك [الدرس 3]."
    monkeypatch.setattr(assistant, "complete", fake_complete)
    r = staff.post("/api/assistant/ask", {"question": "ما هي العلامة الشخصية؟"}).json()
    assert r["grounded"] and not r["fallback"] and r["sources"]
    prompt = seen["messages"][1]["content"]
    assert "[الدرس" in prompt and "العلامة الشخصية" in prompt  # retrieved, labelled course passages reach the model
    assert "أجب فقط من المقتطفات" in seen["messages"][0]["content"]  # grounded-only system rules
    assert "test-key" not in str(r)

    ai.ai_enabled_for_learners = True
    assert t.get("/api/assistant/status").json()["available"] is True

    def broken(messages):
        raise assistant.ProviderError("http_503")
    monkeypatch.setattr(assistant, "complete", broken)
    r = t.post("/api/assistant/ask", {"question": "منظومة القيم والهوية", "lang": "en"}).json()
    assert r["fallback"] and r["excerpts"] and r["excerpts"][0]["label"].startswith(("Lesson", "Book"))
    r = t.post("/api/assistant/ask", {"question": "zzzz qqqq"}).json()  # nothing relevant: no model call, honest answer
    assert r["grounded"] is False and r["sources"] == []
    r = t.post("/api/assistant/ask", {"question": "الهوية"})
    assert r.status_code == 429  # daily limit (2) reached


def test_trainee_without_identity_enrollment_cannot_ask(ai):
    ai.ai_api_key, ai.ai_enabled_for_learners = "test-key", True
    t = Api()
    t.login(make_user().email)
    assert t.post("/api/assistant/ask", {"question": "ما هي الهوية؟"}).status_code == 403


def test_provider_client_uses_fallback_models(ai, monkeypatch):
    calls = []

    class R:
        def __init__(self, code, text=""):
            self.status_code, self._t = code, text

        def json(self):
            return {"choices": [{"message": {"content": self._t}}]}

    def post(url, headers, timeout, json):
        calls.append(json["model"])
        assert headers["Authorization"] == "Bearer k" and url.endswith("/chat/completions")
        return R(503) if len(calls) == 1 else R(200, "<think>x</think>جواب [الدرس 1]")
    s = get_settings()
    saved = (s.ai_model, s.ai_fallback_models)
    try:
        ai.ai_api_key, s.ai_model, s.ai_fallback_models = "k", "primary/model", "backup/model"
        monkeypatch.setattr(assistant.httpx, "post", post)
        assert assistant.complete([{"role": "user", "content": "q"}]) == "جواب [الدرس 1]"
        assert calls == ["primary/model", "backup/model"]
    finally:
        s.ai_model, s.ai_fallback_models = saved
