"""add classified_offset to entry table

Revision ID: 003
Revises: 002
Create Date: 2026-03-17 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("entry", sa.Column("classified_offset", sa.Integer(), nullable=True, server_default="0"))


def downgrade():
    op.drop_column("entry", "classified_offset")
