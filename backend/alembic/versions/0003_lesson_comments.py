"""Trainer comments on sections (additive).

Revision ID: 0003
Revises: 0002
"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("lesson_comments",
                    sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
                    sa.Column("enrollment_id", sa.Uuid(), sa.ForeignKey("enrollments.id", ondelete="CASCADE"), nullable=False, index=True),
                    sa.Column("lesson_id", sa.Uuid(), sa.ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False, index=True),
                    sa.Column("author_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
                    sa.Column("text", sa.Text(), nullable=False),
                    sa.Column("created_at", sa.DateTime(), nullable=False))


def downgrade() -> None:
    op.drop_table("lesson_comments")
