"""create route_templates and route_template_streets

Revision ID: 005
Revises: 004
Create Date: 2026-04-08 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "route_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
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
    )

    op.create_table(
        "route_template_streets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "template_id",
            UUID(as_uuid=True),
            sa.ForeignKey("route_templates.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "street_id",
            UUID(as_uuid=True),
            sa.ForeignKey("streets.id"),
            nullable=False,
        ),
        sa.Column("visit_order", sa.Integer(), nullable=False),
        sa.UniqueConstraint("template_id", "street_id", name="uq_route_template_streets"),
    )

    op.create_index("ix_route_template_streets_template_id", "route_template_streets", ["template_id"])
    op.create_index("ix_route_template_streets_visit_order", "route_template_streets", ["template_id", "visit_order"])


def downgrade() -> None:
    op.drop_index("ix_route_template_streets_visit_order", table_name="route_template_streets")
    op.drop_index("ix_route_template_streets_template_id", table_name="route_template_streets")
    op.drop_table("route_template_streets")
    op.drop_table("route_templates")
