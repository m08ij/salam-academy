"""Relational model. Personal data is separated from training records so it can be exported or erased cleanly."""
import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base, utcnow

ROLES = ("owner", "admin", "developer", "trainer", "trainee")
STAFF_ROLES = ("owner", "admin", "developer", "trainer")


def _id() -> uuid.UUID:
    return uuid.uuid4()


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_id)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)  # stored lower-case
    name: Mapped[str] = mapped_column(String(120))
    locale: Mapped[str] = mapped_column(String(5), default="ar")
    role: Mapped[str] = mapped_column(String(16), default="trainee", index=True)
    status: Mapped[str] = mapped_column(String(16), default="invited")  # invited|active|suspended|deleted
    password_hash: Mapped[str | None] = mapped_column(String(255))
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    mfa_secret_enc: Mapped[str | None] = mapped_column(String(512))
    mfa_pending_enc: Mapped[str | None] = mapped_column(String(512))
    mfa_last_step: Mapped[int | None] = mapped_column(Integer)
    failed_logins: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    share_reflections: Mapped[bool] = mapped_column(Boolean, default=False)
    share_plan: Mapped[bool] = mapped_column(Boolean, default=False)


class Session(Base):
    __tablename__ = "sessions"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_id)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    csrf_hash: Mapped[str] = mapped_column(String(64))
    mfa_passed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime)
    ip: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(300))
    user: Mapped[User] = relationship()


class Token(Base):
    """Single-use, hashed, expiring tokens for invitations, password resets and e-mail verification."""
    __tablename__ = "tokens"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_id)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(16))  # invite|reset|verify
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class RecoveryCode(Base):
    __tablename__ = "recovery_codes"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_id)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    used_at: Mapped[datetime | None] = mapped_column(DateTime)


class RateEvent(Base):
    __tablename__ = "rate_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(200), index=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, index=True)
    actor_role: Mapped[str | None] = mapped_column(String(16))
    action: Mapped[str] = mapped_column(String(48), index=True)
    target_type: Mapped[str | None] = mapped_column(String(32))
    target_id: Mapped[str | None] = mapped_column(String(64))
    ip: Mapped[str | None] = mapped_column(String(64))
    detail: Mapped[dict] = mapped_column(JSON, default=dict)


class Setting(Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


# ---------------- programs ----------------
class Program(Base):
    __tablename__ = "programs"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_id)
    slug: Mapped[str] = mapped_column(String(64), unique=True)
    title_ar: Mapped[str] = mapped_column(String(200))
    title_en: Mapped[str] = mapped_column(String(200), default="")
    desc_ar: Mapped[str] = mapped_column(Text, default="")
    desc_en: Mapped[str] = mapped_column(Text, default="")
    active: Mapped[bool] = mapped_column(Boolean, default=False)
    self_enroll: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
    levels: Mapped[list["Level"]] = relationship(order_by="Level.position", cascade="all, delete-orphan", back_populates="program")


class Level(Base):
    __tablename__ = "levels"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_id)
    program_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("programs.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)  # 1-based
    title_ar: Mapped[str] = mapped_column(String(200))
    title_en: Mapped[str] = mapped_column(String(200), default="")
    desc_ar: Mapped[str] = mapped_column(Text, default="")
    desc_en: Mapped[str] = mapped_column(Text, default="")
    min_quiz: Mapped[float] = mapped_column(Float, default=70)
    min_eval: Mapped[float] = mapped_column(Float, default=3.5)
    min_project: Mapped[float] = mapped_column(Float, default=70)
    min_final: Mapped[float] = mapped_column(Float, default=70)
    w_quiz: Mapped[int] = mapped_column(Integer, default=40)
    w_eval: Mapped[int] = mapped_column(Integer, default=30)
    w_project: Mapped[int] = mapped_column(Integer, default=30)
    project_required: Mapped[bool] = mapped_column(Boolean, default=True)
    project_title_ar: Mapped[str] = mapped_column(String(200), default="")
    project_title_en: Mapped[str] = mapped_column(String(200), default="")
    project_brief_ar: Mapped[str] = mapped_column(Text, default="")
    project_brief_en: Mapped[str] = mapped_column(Text, default="")
    program: Mapped[Program] = relationship(back_populates="levels")
    courses: Mapped[list["Course"]] = relationship(order_by="Course.position", cascade="all, delete-orphan", back_populates="level")


class Course(Base):
    __tablename__ = "courses"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_id)
    level_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("levels.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    title_ar: Mapped[str] = mapped_column(String(200))
    title_en: Mapped[str] = mapped_column(String(200), default="")
    level: Mapped[Level] = relationship(back_populates="courses")
    lessons: Mapped[list["Lesson"]] = relationship(order_by="Lesson.position", cascade="all, delete-orphan", back_populates="course")


class Lesson(Base):
    __tablename__ = "lessons"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_id)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    title_ar: Mapped[str] = mapped_column(String(200))
    title_en: Mapped[str] = mapped_column(String(200), default="")
    hours: Mapped[float] = mapped_column(Float, default=1)
    body_ar: Mapped[str] = mapped_column(Text, default="")
    body_en: Mapped[str] = mapped_column(Text, default="")
    video_url: Mapped[str] = mapped_column(String(500), default="")
    group_ref: Mapped[int | None] = mapped_column(Integer)  # link to a Names group in the catalog
    course: Mapped[Course] = relationship(back_populates="lessons")
    questions: Mapped[list["Question"]] = relationship(order_by="Question.position", cascade="all, delete-orphan", back_populates="lesson")


class Question(Base):
    __tablename__ = "questions"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_id)
    lesson_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    q_ar: Mapped[str] = mapped_column(Text)
    q_en: Mapped[str] = mapped_column(Text, default="")
    options: Mapped[list] = mapped_column(JSON)  # [[ar, en], ...]
    correct: Mapped[int] = mapped_column(Integer)
    lesson: Mapped[Lesson] = relationship(back_populates="questions")


class Cohort(Base):
    __tablename__ = "cohorts"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_id)
    program_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("programs.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    starts_on: Mapped[str | None] = mapped_column(String(10))
    ends_on: Mapped[str | None] = mapped_column(String(10))
    mode: Mapped[str] = mapped_column(String(16), default="online")
    place: Mapped[str] = mapped_column(String(200), default="")
    capacity: Mapped[int] = mapped_column(Integer, default=30)


class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint("user_id", "program_id"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_id)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    program_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("programs.id", ondelete="CASCADE"), index=True)
    trainer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    cohort_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("cohorts.id", ondelete="SET NULL"))
    level_position: Mapped[int] = mapped_column(Integer, default=1)
    graduated_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    user: Mapped[User] = relationship(foreign_keys=[user_id])
    trainer: Mapped[User | None] = relationship(foreign_keys=[trainer_id])
    program: Mapped[Program] = relationship()


class LessonProgress(Base):
    __tablename__ = "lesson_progress"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    lesson_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"), primary_key=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_id)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    lesson_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"), index=True)
    score: Mapped[int] = mapped_column(Integer)
    total: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Reflection(Base):
    __tablename__ = "reflections"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    lesson_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"), primary_key=True)
    text: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class GrowthPlan(Base):
    __tablename__ = "growth_plans"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class ProjectSubmission(Base):
    __tablename__ = "project_submissions"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_id)
    enrollment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("enrollments.id", ondelete="CASCADE"), index=True)
    level_position: Mapped[int] = mapped_column(Integer)
    version: Mapped[int] = mapped_column(Integer, default=1)
    title: Mapped[str] = mapped_column(String(160))
    summary: Mapped[str] = mapped_column(Text)
    link: Mapped[str] = mapped_column(String(500), default="")
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ProjectReview(Base):
    __tablename__ = "project_reviews"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_id)
    submission_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("project_submissions.id", ondelete="CASCADE"), index=True)
    reviewer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    grade: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(16))  # approved|revise
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Evaluation(Base):
    __tablename__ = "evaluations"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_id)
    enrollment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("enrollments.id", ondelete="CASCADE"), index=True)
    level_position: Mapped[int] = mapped_column(Integer)
    trainer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    scores: Mapped[list] = mapped_column(JSON)
    criteria: Mapped[list] = mapped_column(JSON)  # rubric snapshot at evaluation time
    avg: Mapped[float] = mapped_column(Float)
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Promotion(Base):
    __tablename__ = "promotions"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_id)
    enrollment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("enrollments.id", ondelete="CASCADE"), index=True)
    from_level: Mapped[int] = mapped_column(Integer)
    to_level: Mapped[int | None] = mapped_column(Integer)  # null = graduation
    final: Mapped[float] = mapped_column(Float)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    override: Mapped[bool] = mapped_column(Boolean, default=False)
    reason: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Announcement(Base):
    __tablename__ = "announcements"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_id)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, default="")
    author_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


# ---------------- Salam values catalog (read-only reference data) ----------------
class CatGroup(Base):
    __tablename__ = "cat_groups"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    position: Mapped[int] = mapped_column(Integer)
    title_ar: Mapped[str] = mapped_column(String(120))
    title_en: Mapped[str] = mapped_column(String(120))
    desc_ar: Mapped[str] = mapped_column(Text, default="")
    desc_en: Mapped[str] = mapped_column(Text, default="")
    color: Mapped[str] = mapped_column(String(9), default="#cccccc")
    skills: Mapped[list] = mapped_column(JSON, default=list)


class CatName(Base):
    __tablename__ = "cat_names"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title_ar: Mapped[str] = mapped_column(String(120))
    title_en: Mapped[str] = mapped_column(String(160))
    group_id: Mapped[int | None] = mapped_column(ForeignKey("cat_groups.id"))


class CatValue(Base):
    __tablename__ = "cat_values"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    relation: Mapped[int] = mapped_column(Integer, index=True)  # 1 Allah · 2 self · 3 others
    family: Mapped[int] = mapped_column(Integer, index=True)
    title_ar: Mapped[str] = mapped_column(String(200))
    title_en: Mapped[str] = mapped_column(String(200))
    scale: Mapped[dict] = mapped_column(JSON, default=dict)  # balance/excess/deficit [ar,en]


class CatBehavior(Base):
    __tablename__ = "cat_behaviors"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    value_id: Mapped[int] = mapped_column(ForeignKey("cat_values.id"), index=True)
    name_id: Mapped[int] = mapped_column(ForeignKey("cat_names.id"), index=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("cat_groups.id"), index=True)
    text_ar: Mapped[str] = mapped_column(Text)
    text_en: Mapped[str] = mapped_column(Text, default="")
    unofficial_en: Mapped[bool] = mapped_column(Boolean, default=False)
