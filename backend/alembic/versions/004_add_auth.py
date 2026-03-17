"""Add auth: users table and role column on team_members

Revision ID: 004_add_auth
Revises: 003_channel_name
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "004_add_auth"
down_revision: Union[str, None] = "003_channel_name"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create users table for global auth
    op.create_table(
        "users",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("slack_user_id", sa.String(64), nullable=True),
        sa.Column("is_admin", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("last_login_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # Add role column to team_members
    op.add_column(
        "team_members",
        sa.Column("role", sa.String(20), nullable=False, server_default="worker"),
    )


def downgrade() -> None:
    op.drop_column("team_members", "role")
    op.drop_table("users")
