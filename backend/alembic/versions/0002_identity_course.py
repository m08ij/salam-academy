"""Identity course: self-paced programs and assistant knowledge (additive only).

Revision ID: 0002
Revises: 0001
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("programs") as b:
        b.add_column(sa.Column("self_paced", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_table(
        "knowledge_chunks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("program_slug", sa.String(64), nullable=False, index=True),
        sa.Column("source", sa.String(16), nullable=False),
        sa.Column("ref", sa.String(32), nullable=False),
        sa.Column("title", sa.String(300), nullable=False, server_default=""),
        sa.Column("text", sa.Text(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("knowledge_chunks")
    with op.batch_alter_table("programs") as b:
        b.drop_column("self_paced")
