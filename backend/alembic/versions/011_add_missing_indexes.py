"""Adiciona índices compostos nas colunas mais filtradas

Revision ID: 011
Revises: 010
Create Date: 2026-04-17 00:00:00.000000

Fix 2.3 do PLANO_QA.md:
- (client_id, is_active) em sales — cálculo de saldo de cliente
- (client_id, is_active) em payments — cálculo de saldo de cliente
- (route_id, visit_order) em route_streets — ordenação de ruas na rota
"""
from alembic import op


revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Índice composto em sales(client_id, is_active)
    # Usado em todo cálculo de saldo (fiado) por cliente
    op.create_index(
        "ix_sales_client_id_is_active",
        "sales",
        ["client_id", "is_active"],
    )

    # Índice composto em payments(client_id, is_active)
    # Usado em todo cálculo de saldo (pagamentos) por cliente
    op.create_index(
        "ix_payments_client_id_is_active",
        "payments",
        ["client_id", "is_active"],
    )

    # Índice composto em route_streets(route_id, visit_order)
    # Usado na ordenação dos clientes na rota
    op.create_index(
        "ix_route_streets_route_id_visit_order",
        "route_streets",
        ["route_id", "visit_order"],
    )


def downgrade() -> None:
    op.drop_index("ix_route_streets_route_id_visit_order", table_name="route_streets")
    op.drop_index("ix_payments_client_id_is_active", table_name="payments")
    op.drop_index("ix_sales_client_id_is_active", table_name="sales")
