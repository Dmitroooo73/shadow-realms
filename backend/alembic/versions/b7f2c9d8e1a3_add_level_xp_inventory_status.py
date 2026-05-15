"""add level, xp, created_at, status effects, items

Revision ID: b7f2c9d8e1a3
Revises: a1b2c3d4e5f6
Create Date: 2026-04-19

"""
from alembic import op
import sqlalchemy as sa


revision = 'b7f2c9d8e1a3'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('characters', sa.Column('level', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('characters', sa.Column('xp', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('characters', sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()))
    op.add_column('characters', sa.Column('status_poison', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('characters', sa.Column('status_bleeding', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('characters', sa.Column('status_berserk', sa.Integer(), nullable=False, server_default='0'))

    op.create_table(
        'items',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('character_id', sa.Integer(), sa.ForeignKey('characters.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('effect_type', sa.String(), nullable=False, server_default='none'),
        sa.Column('effect_value', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_used', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table('items')
    op.drop_column('characters', 'status_berserk')
    op.drop_column('characters', 'status_bleeding')
    op.drop_column('characters', 'status_poison')
    op.drop_column('characters', 'created_at')
    op.drop_column('characters', 'xp')
    op.drop_column('characters', 'level')
