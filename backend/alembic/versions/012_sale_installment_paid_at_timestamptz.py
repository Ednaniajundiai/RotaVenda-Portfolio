"""Converte SaleInstallment.paid_at de Date para DateTime(timezone=True)

Revision ID: 012
Revises: 011
Create Date: 2026-04-17 00:00:00.000000

Fix 3.9 do PLANO_QA.md:
Armazenar o timestamp exato em que a parcela foi paga, não apenas a data.
Preserva os dados existentes convertendo Date → TIMESTAMPTZ.
"""
import sqlalchemy as sa
from alembic import op


revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "sale_installments",
        "paid_at",
        existing_type=sa.Date(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
        postgresql_using="paid_at::timestamptz",
    )


def downgrade() -> None:
    op.alter_column(
        "sale_installments",
        "paid_at",
        existing_type=sa.DateTime(timezone=True),
        type_=sa.Date(),
        existing_nullable=True,
        postgresql_using="paid_at::date",
    )
