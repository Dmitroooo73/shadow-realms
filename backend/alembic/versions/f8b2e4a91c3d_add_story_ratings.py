"""add story_ratings table

Revision ID: f8b2e4a91c3d
Revises: e5c7a1b3f6d2
Create Date: 2026-04-20
"""
from alembic import op
import sqlalchemy as sa


revision = 'f8b2e4a91c3d'
down_revision = 'e5c7a1b3f6d2'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'story_ratings',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column(
            'message_id',
            sa.Integer(),
            sa.ForeignKey('story_messages.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column(
            'user_id',
            sa.Integer(),
            sa.ForeignKey('users.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('kind', sa.String(), nullable=False),  # like | skull | fire
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('message_id', 'user_id', name='uq_story_ratings_user_message'),
    )
    op.create_index('ix_story_ratings_message_id', 'story_ratings', ['message_id'])


def downgrade():
    op.drop_index('ix_story_ratings_message_id', table_name='story_ratings')
    op.drop_table('story_ratings')
