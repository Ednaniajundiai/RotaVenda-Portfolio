"""rename users.username to users.email

Revision ID: 010
Revises: 009
Create Date: 2026-04-17 00:00:00.000000

Alinha o banco ao ORM: a coluna foi renomeada manualmente no banco para
`username`, mas todo o código (models, schemas, auth, tests) usa `email`
com validação EmailStr. Esta migration restaura o nome original.
"""
from alembic import op
import sqlalchemy as sa


revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    has_username = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name='users' AND column_name='username'"
        )
    ).scalar()
    if has_username:
        op.alter_column("users", "username", new_column_name="email")

    has_old_idx = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_indexes "
            "WHERE tablename='users' AND indexname='ix_users_username'"
        )
    ).scalar()
    if has_old_idx:
        op.execute("ALTER INDEX ix_users_username RENAME TO ix_users_email")

    has_new_idx = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_indexes "
            "WHERE tablename='users' AND indexname='ix_users_email'"
        )
    ).scalar()
    if not has_new_idx:
        op.create_index("ix_users_email", "users", ["email"], unique=True)


def downgrade() -> None:
    conn = op.get_bind()
    has_new_idx = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_indexes "
            "WHERE tablename='users' AND indexname='ix_users_email'"
        )
    ).scalar()
    if has_new_idx:
        op.execute("ALTER INDEX ix_users_email RENAME TO ix_users_username")

    has_email = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name='users' AND column_name='email'"
        )
    ).scalar()
    if has_email:
        op.alter_column("users", "email", new_column_name="username")
