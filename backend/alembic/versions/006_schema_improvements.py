"""Schema improvements: CHECK constraints, UNIQUE constraints, indexes, FK ON DELETE

Revision ID: 006_schema_improvements
Revises: 005_assignees
Create Date: 2026-03-18

Adds:
- CHECK constraints on issues.status, issues.priority, team_members.role
- UNIQUE constraint on team_members(team_id, email)
- Indexes on users(email), team_members(email), team_members(team_id, is_active),
  issues(created_at DESC)
- ON DELETE SET NULL for issues.team_id, issues.assigned_to, issues.resolved_by FKs
- updated_at column on users table
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "006_schema_improvements"
down_revision: Union[str, None] = "005_assignees"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---------------------------------------------------------------
    # 1. Sanitize existing data so CHECK constraints won't fail
    # ---------------------------------------------------------------
    # Normalize any status values not in the allowed set
    op.execute(
        "UPDATE issues SET status = 'open' "
        "WHERE status NOT IN ('open', 'in_progress', 'resolved', 'closed')"
    )
    # Normalize any priority values not in the allowed set (NULL is OK)
    op.execute(
        "UPDATE issues SET priority = NULL "
        "WHERE priority IS NOT NULL "
        "AND priority NOT IN ('low', 'medium', 'high', 'critical')"
    )
    # Normalize any role values not in the allowed set
    op.execute(
        "UPDATE team_members SET role = 'worker' "
        "WHERE role NOT IN ('leader', 'worker')"
    )

    # ---------------------------------------------------------------
    # 2. CHECK constraints
    # ---------------------------------------------------------------
    op.create_check_constraint(
        "ck_issues_status",
        "issues",
        "status IN ('open', 'in_progress', 'resolved', 'closed')",
    )
    op.create_check_constraint(
        "ck_issues_priority",
        "issues",
        "priority IS NULL OR priority IN ('low', 'medium', 'high', 'critical')",
    )
    op.create_check_constraint(
        "ck_team_members_role",
        "team_members",
        "role IN ('leader', 'worker')",
    )

    # ---------------------------------------------------------------
    # 3. UNIQUE constraints
    # ---------------------------------------------------------------
    # Deduplicate team_members with same (team_id, email) before adding constraint.
    # Keep the oldest row (min id by created_at), delete newer duplicates.
    # Only applies where email is not null (null emails are allowed to repeat).
    op.execute("""
        DELETE FROM team_members
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY team_id, email
                           ORDER BY created_at ASC
                       ) AS rn
                FROM team_members
                WHERE email IS NOT NULL
            ) ranked
            WHERE rn > 1
        )
    """)
    op.create_unique_constraint(
        "uq_team_members_team_id_email",
        "team_members",
        ["team_id", "email"],
    )

    # ---------------------------------------------------------------
    # 4. Indexes
    # ---------------------------------------------------------------
    # users(email) - the column is already UNIQUE from migration 004 which
    # creates an implicit unique index, but we add an explicit named one
    # for documentation. Skip if the unique constraint already covers it.
    # Actually the unique=True in 004 already created a unique index.
    # We'll add the other missing indexes:
    op.create_index(
        "ix_team_members_email",
        "team_members",
        ["email"],
    )
    op.create_index(
        "ix_team_members_team_id_is_active",
        "team_members",
        ["team_id", "is_active"],
    )
    op.create_index(
        "ix_issues_created_at_desc",
        "issues",
        [sa.text("created_at DESC")],
    )

    # ---------------------------------------------------------------
    # 5. Fix FK ON DELETE behavior
    # ---------------------------------------------------------------
    # issues.team_id -> teams.id : add ON DELETE SET NULL
    op.drop_constraint("issues_team_id_fkey", "issues", type_="foreignkey")
    op.create_foreign_key(
        "issues_team_id_fkey",
        "issues",
        "teams",
        ["team_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # issues.assigned_to -> team_members.id : add ON DELETE SET NULL
    op.drop_constraint("issues_assigned_to_fkey", "issues", type_="foreignkey")
    op.create_foreign_key(
        "issues_assigned_to_fkey",
        "issues",
        "team_members",
        ["assigned_to"],
        ["id"],
        ondelete="SET NULL",
    )

    # issues.resolved_by -> team_members.id : add ON DELETE SET NULL
    op.drop_constraint("issues_resolved_by_fkey", "issues", type_="foreignkey")
    op.create_foreign_key(
        "issues_resolved_by_fkey",
        "issues",
        "team_members",
        ["resolved_by"],
        ["id"],
        ondelete="SET NULL",
    )

    # ---------------------------------------------------------------
    # 6. Add updated_at to users table (was missing)
    # ---------------------------------------------------------------
    op.add_column(
        "users",
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    # Remove updated_at from users
    op.drop_column("users", "updated_at")

    # Restore FK without ON DELETE behavior
    op.drop_constraint("issues_resolved_by_fkey", "issues", type_="foreignkey")
    op.create_foreign_key(
        "issues_resolved_by_fkey",
        "issues",
        "team_members",
        ["resolved_by"],
        ["id"],
    )

    op.drop_constraint("issues_assigned_to_fkey", "issues", type_="foreignkey")
    op.create_foreign_key(
        "issues_assigned_to_fkey",
        "issues",
        "team_members",
        ["assigned_to"],
        ["id"],
    )

    op.drop_constraint("issues_team_id_fkey", "issues", type_="foreignkey")
    op.create_foreign_key(
        "issues_team_id_fkey",
        "issues",
        "teams",
        ["team_id"],
        ["id"],
    )

    # Drop indexes
    op.drop_index("ix_issues_created_at_desc", table_name="issues")
    op.drop_index("ix_team_members_team_id_is_active", table_name="team_members")
    op.drop_index("ix_team_members_email", table_name="team_members")

    # Drop unique constraint
    op.drop_constraint("uq_team_members_team_id_email", "team_members", type_="unique")

    # Drop check constraints
    op.drop_constraint("ck_team_members_role", "team_members", type_="check")
    op.drop_constraint("ck_issues_priority", "issues", type_="check")
    op.drop_constraint("ck_issues_status", "issues", type_="check")
