"""create streets, clients, client_streets tables

Revision ID: 002
Revises: 001
Create Date: 2026-03-30 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "streets",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("neighborhood", sa.String(120), nullable=True),
        sa.Column("cep", sa.String(9), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
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
    op.create_index("idx_streets_name", "streets", ["name"])
    op.create_index("idx_streets_neighborhood", "streets", ["neighborhood"])
    op.create_index("idx_streets_cep", "streets", ["cep"])

    op.create_table(
        "clients",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
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
    op.create_index("idx_clients_name", "clients", ["name"])

    op.create_table(
        "client_streets",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "client_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "street_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("house_number", sa.String(20), nullable=True),
        sa.Column("reference", sa.String(200), nullable=True),
        sa.Column("display_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["client_id"], ["clients.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["street_id"], ["streets.id"], ondelete="CASCADE"
        ),
        sa.UniqueConstraint("client_id", "street_id", name="uq_client_street"),
    )
    op.create_index(
        "idx_client_streets_client_id", "client_streets", ["client_id"]
    )
    op.create_index(
        "idx_client_streets_street_id", "client_streets", ["street_id"]
    )


def downgrade() -> None:
    op.drop_index("idx_client_streets_street_id", table_name="client_streets")
    op.drop_index("idx_client_streets_client_id", table_name="client_streets")
    op.drop_table("client_streets")
    op.drop_index("idx_clients_name", table_name="clients")
    op.drop_table("clients")
    op.drop_index("idx_streets_cep", table_name="streets")
    op.drop_index("idx_streets_neighborhood", table_name="streets")
    op.drop_index("idx_streets_name", table_name="streets")
    op.drop_table("streets")
