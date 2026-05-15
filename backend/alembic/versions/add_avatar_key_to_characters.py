"""add avatar_key to characters

Revision ID: a1b2c3d4e5f6
Revises: xxxx
Create Date: 2026-04-16

"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = 'xxxx'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('characters', sa.Column('avatar_key', sa.String(), nullable=True))


def downgrade():
    op.drop_column('characters', 'avatar_key')
