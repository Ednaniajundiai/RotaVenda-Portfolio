"""add_name_to_routes

Revision ID: 009
Revises: 008
Create Date: 2026-04-16 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Adicionar coluna permitindo NULL
    op.add_column('routes', sa.Column('name', sa.String(length=200), nullable=True))
    
    # 2. Fazer backfill dos dados existentes (usando route_date formatado)
    op.execute("""
        UPDATE routes 
        SET name = 'Rota ' || to_char(route_date, 'DD/MM/YYYY')
        WHERE name IS NULL
    """)
    
    # 3. Alterar a coluna para NOT NULL
    op.alter_column('routes', 'name', existing_type=sa.String(length=200), nullable=False)


def downgrade() -> None:
    op.drop_column('routes', 'name')
