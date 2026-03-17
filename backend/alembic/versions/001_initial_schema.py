"""Initial schema

Revision ID: 001_initial
Revises:
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Teams table
    op.create_table(
        "teams",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "reminder_frequency_minutes",
            sa.Integer(),
            server_default="1440",
            nullable=False,
        ),
        sa.Column(
            "reminder_start_hour",
            sa.Integer(),
            server_default="9",
            nullable=False,
        ),
        sa.Column(
            "notifications_enabled",
            sa.Boolean(),
            server_default="true",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # Team members table
    op.create_table(
        "team_members",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "team_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("teams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slack_user_id", sa.String(64), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column(
            "is_active", sa.Boolean(), server_default="true", nullable=False
        ),
        sa.Column(
            "notifications_muted",
            sa.Boolean(),
            server_default="false",
            nullable=False,
        ),
        sa.Column(
            "open_issue_count",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "total_assigned_count",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # Issues table
    op.create_table(
        "issues",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.String(20),
            server_default="open",
            nullable=False,
        ),
        sa.Column("priority", sa.String(20), nullable=True),
        sa.Column("category", sa.String(255), nullable=True),
        sa.Column(
            "team_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("teams.id"),
            nullable=True,
        ),
        sa.Column(
            "assigned_to",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("team_members.id"),
            nullable=True,
        ),
        sa.Column("reported_by_slack_id", sa.String(64), nullable=True),
        sa.Column("slack_channel_id", sa.String(64), nullable=True),
        sa.Column("slack_thread_ts", sa.String(64), nullable=True),
        sa.Column("slack_message_ts", sa.String(64), nullable=True),
        sa.Column("ai_categorization", postgresql.JSONB(), nullable=True),
        sa.Column("ai_rca", postgresql.JSONB(), nullable=True),
        sa.Column("ai_provider_used", sa.String(32), nullable=True),
        sa.Column("resolved_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "resolved_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("team_members.id"),
            nullable=True,
        ),
        sa.Column(
            "notifications_muted",
            sa.Boolean(),
            server_default="false",
            nullable=False,
        ),
        sa.Column(
            "last_reminder_sent_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # Issue history table
    op.create_table(
        "issue_history",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "issue_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("issues.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("performed_by", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # App config table
    op.create_table(
        "app_config",
        sa.Column("key", sa.String(255), primary_key=True),
        sa.Column("value", sa.Text(), nullable=True),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # Indexes
    op.create_index("ix_issues_status", "issues", ["status"])
    op.create_index("ix_issues_team_id_status", "issues", ["team_id", "status"])
    op.create_index(
        "ix_issues_assigned_to_status", "issues", ["assigned_to", "status"]
    )
    op.create_index(
        "ix_issue_history_issue_id_created_at",
        "issue_history",
        ["issue_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_issue_history_issue_id_created_at", table_name="issue_history")
    op.drop_index("ix_issues_assigned_to_status", table_name="issues")
    op.drop_index("ix_issues_team_id_status", table_name="issues")
    op.drop_index("ix_issues_status", table_name="issues")
    op.drop_table("app_config")
    op.drop_table("issue_history")
    op.drop_table("issues")
    op.drop_table("team_members")
    op.drop_table("teams")
