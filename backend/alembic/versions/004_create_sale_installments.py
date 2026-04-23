"""create sale_installments and installment_payments

Revision ID: 004
Revises: 003
Create Date: 2026-04-08 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sale_installments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "sale_id",
            UUID(as_uuid=True),
            sa.ForeignKey("sales.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column(
            "paid_amount",
            sa.Numeric(12, 2),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("paid_at", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("amount > 0", name="ck_sale_installments_amount_positive"),
        sa.CheckConstraint(
            "paid_amount >= 0", name="ck_paid_amount_non_negative"
        ),
        sa.UniqueConstraint(
            "sale_id", "number", name="uq_sale_installments_sale_number"
        ),
    )

    op.create_table(
        "installment_payments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "installment_id",
            UUID(as_uuid=True),
            sa.ForeignKey("sale_installments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "payment_id",
            UUID(as_uuid=True),
            sa.ForeignKey("payments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.CheckConstraint(
            "amount > 0", name="ck_installment_payments_amount_positive"
        ),
    )

    op.create_index("ix_sale_installments_sale_id", "sale_installments", ["sale_id"])
    op.create_index(
        "ix_sale_installments_due_date", "sale_installments", ["due_date"]
    )
    op.create_index(
        "ix_sale_installments_paid_at", "sale_installments", ["paid_at"]
    )
    op.create_index(
        "ix_installment_payments_installment_id",
        "installment_payments",
        ["installment_id"],
    )
    op.create_index(
        "ix_installment_payments_payment_id",
        "installment_payments",
        ["payment_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_installment_payments_payment_id", table_name="installment_payments"
    )
    op.drop_index(
        "ix_installment_payments_installment_id", table_name="installment_payments"
    )
    op.drop_index("ix_sale_installments_paid_at", table_name="sale_installments")
    op.drop_index("ix_sale_installments_due_date", table_name="sale_installments")
    op.drop_index("ix_sale_installments_sale_id", table_name="sale_installments")
    op.drop_table("installment_payments")
    op.drop_table("sale_installments")
