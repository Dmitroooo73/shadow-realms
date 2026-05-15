"""add is_admin to users

Revision ID: xxxx
Revises: edc064728d74
Create Date: 2025-12-10

"""
from alembic import op
import sqlalchemy as sa

revision = 'xxxx'  
down_revision = 'edc064728d74' 
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('users', sa.Column('is_admin', sa.Integer(), nullable=True, server_default='0'))

def downgrade():
    op.drop_column('users', 'is_admin')
