"""create routes, route_streets, sales, payments

Revision ID: 003
Revises: 002
Create Date: 2026-03-31 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM as PgEnum
from sqlalchemy.dialects.postgresql import UUID

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Definição dos ENUMs reutilizáveis
routestatus = PgEnum("DRAFT", "IN_PROGRESS", "COMPLETED", name="routestatus", create_type=False)
routestreetstatus = PgEnum(
    "PENDING", "IN_PROGRESS", "COMPLETED", "SKIPPED", name="routestreetstatus", create_type=False
)
saletype = PgEnum("ROTA", "LOJA", name="saletype", create_type=False)
paymentmode = PgEnum("A_VISTA", "FIADO", name="paymentmode", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()

    # Criar tipos ENUM com checkfirst=True (idempotente)
    PgEnum("DRAFT", "IN_PROGRESS", "COMPLETED", name="routestatus").create(bind, checkfirst=True)
    PgEnum(
        "PENDING", "IN_PROGRESS", "COMPLETED", "SKIPPED", name="routestreetstatus"
    ).create(bind, checkfirst=True)
    PgEnum("ROTA", "LOJA", name="saletype").create(bind, checkfirst=True)
    PgEnum("A_VISTA", "FIADO", name="paymentmode").create(bind, checkfirst=True)

    op.create_table(
        "routes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "seller_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("route_date", sa.Date(), nullable=False),
        sa.Column(
            "status",
            routestatus,
            nullable=False,
            server_default="DRAFT",
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("seller_id", "route_date", name="uq_routes_seller_date"),
    )

    op.create_table(
        "route_streets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "route_id",
            UUID(as_uuid=True),
            sa.ForeignKey("routes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "street_id",
            UUID(as_uuid=True),
            sa.ForeignKey("streets.id"),
            nullable=False,
        ),
        sa.Column("visit_order", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            routestreetstatus,
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "route_id", "street_id", name="uq_route_streets_route_street"
        ),
    )

    op.create_table(
        "sales",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "client_id",
            UUID(as_uuid=True),
            sa.ForeignKey("clients.id"),
            nullable=False,
        ),
        sa.Column(
            "seller_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "route_street_id",
            UUID(as_uuid=True),
            sa.ForeignKey("route_streets.id"),
            nullable=True,
        ),
        sa.Column(
            "sale_date",
            sa.Date(),
            nullable=False,
            server_default=sa.text("CURRENT_DATE"),
        ),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "sale_type",
            saletype,
            nullable=False,
        ),
        sa.Column(
            "payment_mode",
            paymentmode,
            nullable=False,
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("amount > 0", name="ck_sales_amount_positive"),
    )

    op.create_table(
        "payments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "client_id",
            UUID(as_uuid=True),
            sa.ForeignKey("clients.id"),
            nullable=False,
        ),
        sa.Column(
            "seller_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "route_street_id",
            UUID(as_uuid=True),
            sa.ForeignKey("route_streets.id"),
            nullable=True,
        ),
        sa.Column(
            "payment_date",
            sa.Date(),
            nullable=False,
            server_default=sa.text("CURRENT_DATE"),
        ),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("amount > 0", name="ck_payments_amount_positive"),
    )

    # Índices
    op.create_index("ix_routes_seller_id", "routes", ["seller_id"])
    op.create_index("ix_routes_route_date", "routes", ["route_date"])
    op.create_index("ix_route_streets_route_id", "route_streets", ["route_id"])
    op.create_index("ix_sales_client_id", "sales", ["client_id"])
    op.create_index("ix_sales_sale_date", "sales", ["sale_date"])
    op.create_index("ix_payments_client_id", "payments", ["client_id"])
    op.create_index("ix_payments_payment_date", "payments", ["payment_date"])


def downgrade() -> None:
    op.drop_index("ix_payments_payment_date", table_name="payments")
    op.drop_index("ix_payments_client_id", table_name="payments")
    op.drop_index("ix_sales_sale_date", table_name="sales")
    op.drop_index("ix_sales_client_id", table_name="sales")
    op.drop_index("ix_route_streets_route_id", table_name="route_streets")
    op.drop_index("ix_routes_route_date", table_name="routes")
    op.drop_index("ix_routes_seller_id", table_name="routes")
    op.drop_table("payments")
    op.drop_table("sales")
    op.drop_table("route_streets")
    op.drop_table("routes")

    bind = op.get_bind()
    PgEnum(name="paymentmode").drop(bind, checkfirst=True)
    PgEnum(name="saletype").drop(bind, checkfirst=True)
    PgEnum(name="routestreetstatus").drop(bind, checkfirst=True)
    PgEnum(name="routestatus").drop(bind, checkfirst=True)
