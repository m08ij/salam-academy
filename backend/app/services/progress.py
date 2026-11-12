"""Level statistics and promotion eligibility, computed on the server from stored records only."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Enrollment, Evaluation, Lesson, LessonProgress, Level, ProjectReview, ProjectSubmission, QuizAttempt
from ..util import grade_label


def level_lessons(level: Level) -> list[Lesson]:
    return [ls for c in level.courses for ls in c.lessons]


def required_correct(lesson: Lesson) -> int:
    return min(3, len(lesson.questions))


def best_attempts(db: Session, user_id, lesson_ids) -> dict:
    out: dict = {}
    if not lesson_ids:
        return out
    for a in db.scalars(select(QuizAttempt).where(QuizAttempt.user_id == user_id, QuizAttempt.lesson_id.in_(lesson_ids))):
        cur = out.get(a.lesson_id)
        if cur is None or a.score / a.total > cur.score / cur.total:
            out[a.lesson_id] = a
    return out


def done_ids(db: Session, user_id, lesson_ids) -> dict:
    if not lesson_ids:
        return {}
    return {p.lesson_id: p.completed_at for p in db.scalars(select(LessonProgress).where(LessonProgress.user_id == user_id, LessonProgress.lesson_id.in_(lesson_ids)))}


def latest_submission(db: Session, enrollment_id, pos: int) -> ProjectSubmission | None:
    return db.scalar(select(ProjectSubmission).where(ProjectSubmission.enrollment_id == enrollment_id, ProjectSubmission.level_position == pos).order_by(ProjectSubmission.version.desc()).limit(1))


def latest_review(db: Session, sub: ProjectSubmission | None) -> ProjectReview | None:
    if not sub:
        return None
    return db.scalar(select(ProjectReview).where(ProjectReview.submission_id == sub.id).order_by(ProjectReview.created_at.desc()).limit(1))


def latest_evaluation(db: Session, enrollment_id, pos: int) -> Evaluation | None:
    return db.scalar(select(Evaluation).where(Evaluation.enrollment_id == enrollment_id, Evaluation.level_position == pos).order_by(Evaluation.created_at.desc()).limit(1))


def level_stats(db: Session, en: Enrollment, pos: int | None = None) -> dict:
    levels = en.program.levels
    pos = min(pos or en.level_position, len(levels))
    lv = levels[pos - 1]
    lessons = level_lessons(lv)
    ids = [ls.id for ls in lessons]
    done = done_ids(db, en.user_id, ids)
    best = best_attempts(db, en.user_id, ids)
    quiz_lessons = [ls for ls in lessons if ls.questions]
    has_quiz = bool(quiz_lessons)
    ratios = [best[ls.id].score / best[ls.id].total for ls in quiz_lessons if ls.id in best]
    quiz = round(100 * sum(ratios) / len(ratios)) if ratios else None
    ev = latest_evaluation(db, en.id, pos)
    eval_avg = ev.avg if ev else None
    sub = latest_submission(db, en.id, pos)
    rev = latest_review(db, sub)
    pstat = "none" if not sub else (rev.status if rev else "pending")
    proj = rev.grade if rev else None
    comp = []
    if has_quiz:
        comp.append((lv.w_quiz, quiz or 0))
    comp.append((lv.w_eval, (eval_avg or 0) / 5 * 100))
    if lv.project_required:
        comp.append((lv.w_project, proj or 0))
    tw = sum(w for w, _ in comp)
    final = round(sum(w * v for w, v in comp) / tw) if tw else 0
    checks = [{"key": "lessons", "ok": bool(lessons) and len(done) == len(lessons), "value": f"{len(done)}/{len(lessons)}"}]
    if has_quiz:
        checks.append({"key": "quiz", "ok": quiz is not None and quiz >= lv.min_quiz, "value": quiz, "required": lv.min_quiz})
    checks.append({"key": "eval", "ok": eval_avg is not None and eval_avg >= lv.min_eval, "value": eval_avg, "required": lv.min_eval})
    if lv.project_required:
        checks.append({"key": "project", "ok": pstat == "approved" and proj is not None and proj >= lv.min_project, "value": proj, "status": pstat, "required": lv.min_project})
    checks.append({"key": "final", "ok": final >= lv.min_final, "value": final, "required": lv.min_final})
    complete = eval_avg is not None and (not lv.project_required or proj is not None)
    return {
        "level": pos, "levels": len(levels), "level_title": [lv.title_ar, lv.title_en], "graduated": en.graduated_at is not None,
        "lessons_total": len(lessons), "lessons_done": len(done), "quiz": quiz, "eval": eval_avg, "project": proj, "project_status": pstat,
        "final": final, "final_provisional": not complete, "grade": grade_label(db, final) if complete else None,
        "weights": {"quiz": lv.w_quiz, "eval": lv.w_eval, "project": lv.w_project}, "checks": checks,
        "eligible": all(c["ok"] for c in checks) and en.graduated_at is None,
        "_submission": sub, "_review": rev, "_evaluation": ev,
    }


def public(stats: dict) -> dict:
    return {k: v for k, v in stats.items() if not k.startswith("_")}
