"""add character_class to characters

Revision ID: d9a4f1c3b2e7
Revises: b7f2c9d8e1a3
Create Date: 2026-04-19

"""
from alembic import op
import sqlalchemy as sa


revision = 'd9a4f1c3b2e7'
down_revision = 'b7f2c9d8e1a3'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'characters',
        sa.Column('character_class', sa.String(), nullable=False, server_default='warrior'),
    )


def downgrade():
    op.drop_column('characters', 'character_class')
