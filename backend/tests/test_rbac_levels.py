from sqlalchemy import select

from app.models import Enrollment, Program, Question

from .conftest import PW, Api, make_user, staff_login


def _program(db) -> Program:
    return db.scalar(select(Program).where(Program.slug == "best-version"))


def _correct(db, lesson_id):
    return [q.correct for q in db.scalars(select(Question).where(Question.lesson_id == __import__("uuid").UUID(str(lesson_id))).order_by(Question.position))]


def setup_cohort(db):
    owner, trainer, trainer2 = make_user("owner"), make_user("trainer"), make_user("trainer")
    s1, s2 = make_user(), make_user()
    a = Api()
    staff_login(a, owner)
    p = _program(db)
    e1 = a.post("/api/admin/enrollments", {"user_id": str(s1.id), "program_id": str(p.id), "trainer_id": str(trainer.id)}).json()
    e2 = a.post("/api/admin/enrollments", {"user_id": str(s2.id), "program_id": str(p.id), "trainer_id": str(trainer2.id)}).json()
    return dict(owner=owner, trainer=trainer, trainer2=trainer2, s1=s1, s2=s2, e1=e1["id"], e2=e2["id"], admin_api=a, program=p)


def test_trainee_cannot_reach_staff_endpoints(db):
    s = make_user()
    a = Api()
    a.login(s.email)
    for url in ("/api/training/trainees", "/api/admin/users", "/api/admin/enrollments", "/api/admin/audit"):
        assert a.get(url).status_code == 403, url
    p = _program(db)
    assert a.get(f"/api/programs/{p.id}").status_code == 403
    assert a.put("/api/settings", {"rubric": [["a", "a"], ["b", "b"]], "grades": [{"min": 0, "t": ["x", "x"]}, {"min": 50, "t": ["y", "y"]}]}).status_code == 403


def test_role_rules(db):
    owner, admin = make_user("owner"), make_user("admin")
    target = make_user()
    o, a = Api(), Api()
    staff_login(o, owner)
    staff_login(a, admin)
    assert a.patch(f"/api/admin/users/{target.id}", {"role": "admin"}).status_code == 403  # only the owner grants admin
    assert a.patch(f"/api/admin/users/{target.id}", {"role": "trainer"}).status_code == 200
    assert a.patch(f"/api/admin/users/{admin.id}", {"role": "trainee"}).status_code == 403  # never yourself
    assert a.patch(f"/api/admin/users/{owner.id}", {"status": "suspended"}).status_code == 403  # never the owner
    assert o.patch(f"/api/admin/users/{target.id}", {"role": "admin"}).status_code == 200
    assert a.post("/api/admin/users/invite", {"email": "dev@example.org", "name": "Dev Person", "role": "admin"}).status_code == 403
    dev = make_user("developer")
    d = Api()
    staff_login(d, dev)
    assert d.get("/api/admin/users").status_code == 200  # account support
    assert d.patch(f"/api/admin/users/{target.id}", {"role": "trainer"}).status_code == 403  # but no role changes
    assert d.patch(f"/api/admin/users/{admin.id}", {"status": "suspended"}).status_code == 403  # nor admin accounts
    assert d.post("/api/admin/users/invite", {"email": "dev2@example.org", "name": "Dev Two", "role": "developer"}).status_code == 403
    assert d.post("/api/admin/users/invite", {"email": "trainer9@example.org", "name": "Trainer Nine", "role": "trainer"}).status_code == 200
    assert d.get("/api/training/trainees?scope=all").status_code == 200  # can inspect learners when fixing issues
    assert d.get(f"/api/programs/{_program(db).id}").status_code == 200


def test_trainer_sees_only_assigned(db):
    c = setup_cohort(db)
    t = Api()
    staff_login(t, c["trainer"])
    ids = [x["enrollment_id"] for x in t.get("/api/training/trainees").json()]
    assert c["e1"] in ids and c["e2"] not in ids
    assert t.get(f"/api/training/enrollments/{c['e2']}").status_code == 404
    assert t.post(f"/api/training/enrollments/{c['e2']}/evaluation", {"scores": [5, 5, 5, 5, 5]}).status_code == 404
    assert t.post(f"/api/training/enrollments/{c['e1']}/override", {"reason": "trainers cannot override"}).status_code == 403


def test_levels_gating_quiz_project_promotion(db):
    c = setup_cohort(db)
    s = Api()
    s.login(c["s1"].email)
    tree = s.get(f"/api/learn/enrollments/{c['e1']}").json()
    assert [lv["locked"] for lv in tree["levels"]] == [False, True, True]
    l2 = tree["levels"][1]["courses"][0]["lessons"][0]["id"]
    assert s.get(f"/api/learn/enrollments/{c['e1']}/lessons/{l2}").status_code == 403
    l1 = [ls for crs in tree["levels"][0]["courses"] for ls in crs["lessons"]]
    first = s.get(f"/api/learn/enrollments/{c['e1']}/lessons/{l1[0]['id']}").json()
    assert first["questions"] and all("correct" not in q for q in first["questions"])  # answers stay on the server
    assert s.post(f"/api/learn/enrollments/{c['e1']}/lessons/{l1[0]['id']}/complete").status_code == 409
    wrong = [(x + 1) % len(q["options"]) for x, q in zip(_correct(db, first["id"]), first["questions"], strict=True)]
    r = s.post(f"/api/learn/enrollments/{c['e1']}/lessons/{l1[0]['id']}/quiz", {"answers": wrong}).json()
    assert r["score"] == 0 and not r["passed"]
    for ls in l1:
        if ls["has_quiz"]:
            r = s.post(f"/api/learn/enrollments/{c['e1']}/lessons/{ls['id']}/quiz", {"answers": _correct(db, ls["id"])}).json()
            assert r["passed"]
        assert s.post(f"/api/learn/enrollments/{c['e1']}/lessons/{ls['id']}/complete").status_code == 200
    s.put(f"/api/learn/enrollments/{c['e1']}/lessons/{l1[0]['id']}/reflection", {"text": "private thought"})
    # trainee cannot promote themselves
    assert s.post(f"/api/training/enrollments/{c['e1']}/promote").status_code == 403
    t = Api()
    staff_login(t, c["trainer"])
    r = t.post(f"/api/training/enrollments/{c['e1']}/promote")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "not_eligible"
    assert t.post(f"/api/training/enrollments/{c['e1']}/review", {"grade": 90, "status": "approved"}).status_code == 409  # nothing submitted yet
    assert s.post(f"/api/learn/enrollments/{c['e1']}/project", {"title": "My growth plan", "summary": "Two weeks of daily practice with a log.", "link": "javascript:alert(1)"}).status_code == 422
    assert s.post(f"/api/learn/enrollments/{c['e1']}/project", {"title": "My growth plan", "summary": "Two weeks of daily practice with a log.", "link": "https://example.org/plan"}).status_code == 200
    assert t.post(f"/api/training/enrollments/{c['e1']}/review", {"grade": 86, "status": "approved", "note": "solid"}).status_code == 200
    assert t.post(f"/api/training/enrollments/{c['e1']}/evaluation", {"scores": [4, 4, 4]}).status_code == 422
    assert t.post(f"/api/training/enrollments/{c['e1']}/evaluation", {"scores": [4, 4, 5, 4, 4], "note": "committed"}).status_code == 200
    f = t.get(f"/api/training/enrollments/{c['e1']}").json()
    assert f["journey"]["stats"]["eligible"] is True
    assert f["reflections"] == []  # not shared
    r = t.post(f"/api/training/enrollments/{c['e1']}/promote")
    assert r.status_code == 200 and r.json()["to"] == 2
    tree = s.get(f"/api/learn/enrollments/{c['e1']}").json()
    assert [lv["locked"] for lv in tree["levels"]] == [False, False, True]
    assert s.get(f"/api/learn/enrollments/{c['e1']}/lessons/{l2}").status_code == 200
    # sharing reflections makes them visible to the trainer
    s.put("/api/me/privacy", {"share_reflections": True, "share_plan": False})
    assert t.get(f"/api/training/enrollments/{c['e1']}").json()["reflections"][0]["text"] == "private thought"
    # admin override needs a real reason and is recorded
    a = c["admin_api"]
    assert a.post(f"/api/training/enrollments/{c['e1']}/override", {"reason": "short"}).status_code == 422
    assert a.post(f"/api/training/enrollments/{c['e1']}/override", {"reason": "Completed level 2 in the on-site cohort"}).json()["to"] == 3
    r = a.post(f"/api/training/enrollments/{c['e1']}/override", {"reason": "Capstone presented to the panel"}).json()
    assert r["graduated"] is True
    en = db.get(Enrollment, __import__("uuid").UUID(c["e1"]))
    db.refresh(en)
    assert en.graduated_at is not None
    acts = [x["action"] for x in a.get("/api/admin/audit?limit=200").json()]
    assert "trainee_promoted" in acts and "trainee_override_promoted" in acts and "project_reviewed" in acts


def test_export_and_erasure(db):
    c = setup_cohort(db)
    s = Api()
    s.login(c["s2"].email)
    data = s.get("/api/me/export").json()
    assert data["profile"]["email"] == c["s2"].email
    assert s.post("/api/me/delete", {"password": "wrong"}).status_code == 401
    assert s.post("/api/me/delete", {"password": PW}).status_code == 200
    assert Api().login(c["s2"].email).status_code == 401


def test_program_builder_validation(db):
    dev = make_user("developer")
    d = Api()
    staff_login(d, dev)
    bad = {"title_ar": "برنامج", "levels": [{"title_ar": "م١", "w_quiz": 50, "w_eval": 30, "w_project": 30, "courses": [{"title_ar": "مقرر", "lessons": [{"title_ar": "درس"}]}]}]}
    assert d.post("/api/programs", bad).status_code == 422  # weights must add to 100
    good = {"title_ar": "تأهيل المدربين", "title_en": "Trainer qualification", "levels": [{"title_ar": "م١", "courses": [{"title_ar": "مقرر", "lessons": [{"title_ar": "درس", "video_url": "https://example.org/v",
            "questions": [{"q_ar": "س؟", "options": [["أ", "A"], ["ب", "B"]], "correct": 1}]}]}]}]}
    r = d.post("/api/programs", good)
    assert r.status_code == 200, r.text
    p = r.json()
    lesson_id = p["levels"][0]["courses"][0]["lessons"][0]["id"]
    good["levels"][0]["courses"][0]["lessons"][0]["id"] = lesson_id
    good["levels"].append({"title_ar": "م٢", "courses": [{"title_ar": "مقرر ٢", "lessons": [{"title_ar": "درس ٢"}]}]})
    p2 = d.put(f"/api/programs/{p['id']}", good).json()
    assert p2["levels"][0]["courses"][0]["lessons"][0]["id"] == lesson_id  # ids preserved → progress survives edits
    assert len(p2["levels"]) == 2
    bad_video = good | {"levels": [good["levels"][0] | {"courses": [{"title_ar": "x", "lessons": [{"title_ar": "y", "video_url": "javascript:alert(1)"}]}]}]}
    assert d.put(f"/api/programs/{p['id']}", bad_video).status_code == 422
