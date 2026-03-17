"""Add slack_channel_name to issues

Revision ID: 003_channel_name
Revises: 002_reporter_info
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "003_channel_name"
down_revision: Union[str, None] = "002_reporter_info"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("issues", sa.Column("slack_channel_name", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("issues", "slack_channel_name")
