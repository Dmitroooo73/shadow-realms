"""add arena_matches table

Revision ID: a3c5e9b1d7f4
Revises: f8b2e4a91c3d
Create Date: 2026-04-20
"""
from alembic import op
import sqlalchemy as sa


revision = 'a3c5e9b1d7f4'
down_revision = 'f8b2e4a91c3d'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'arena_matches',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column(
            'attacker_id',
            sa.Integer(),
            sa.ForeignKey('characters.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column(
            'defender_id',
            sa.Integer(),
            sa.ForeignKey('characters.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column(
            'winner_id',
            sa.Integer(),
            sa.ForeignKey('characters.id', ondelete='SET NULL'),
            nullable=True,
        ),
        sa.Column('rounds', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('log', sa.Text(), nullable=False, server_default=''),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_arena_matches_attacker_id', 'arena_matches', ['attacker_id'])
    op.create_index('ix_arena_matches_defender_id', 'arena_matches', ['defender_id'])


def downgrade():
    op.drop_index('ix_arena_matches_defender_id', table_name='arena_matches')
    op.drop_index('ix_arena_matches_attacker_id', table_name='arena_matches')
    op.drop_table('arena_matches')
