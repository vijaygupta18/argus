"""Add reporter name and email to issues

Revision ID: 002_reporter_info
Revises: 001_initial
Create Date: 2026-03-17

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002_reporter_info"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("issues", sa.Column("reported_by_name", sa.String(255), nullable=True))
    op.add_column("issues", sa.Column("reported_by_email", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("issues", "reported_by_email")
    op.drop_column("issues", "reported_by_name")
