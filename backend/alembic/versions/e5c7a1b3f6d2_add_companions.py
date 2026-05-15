"""add companions table

Revision ID: e5c7a1b3f6d2
Revises: d9a4f1c3b2e7
Create Date: 2026-04-20
"""
from alembic import op
import sqlalchemy as sa


revision = 'e5c7a1b3f6d2'
down_revision = 'd9a4f1c3b2e7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'companions',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column(
            'character_id',
            sa.Integer(),
            sa.ForeignKey('characters.id', ondelete='CASCADE'),
            nullable=False,
            unique=True,
        ),
        sa.Column('kind', sa.String(), nullable=False),  # wolf | skeleton | spirit
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('hp', sa.Integer(), nullable=False, server_default='20'),
        sa.Column('is_alive', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_companions_character_id', 'companions', ['character_id'])


def downgrade():
    op.drop_index('ix_companions_character_id', table_name='companions')
    op.drop_table('companions')
