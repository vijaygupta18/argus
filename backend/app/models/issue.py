import uuid

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class Issue(Base):
    __tablename__ = "issues"
    __table_args__ = (
        CheckConstraint(
            "status IN ('open', 'in_progress', 'resolved', 'closed')",
            name="ck_issues_status",
        ),
        CheckConstraint(
            "priority IS NULL OR priority IN ('low', 'medium', 'high', 'critical')",
            name="ck_issues_priority",
        ),
        Index("ix_issues_status", "status"),
        Index("ix_issues_team_id_status", "team_id", "status"),
        Index("ix_issues_assigned_to_status", "assigned_to", "status"),
        Index("ix_issues_created_at_desc", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="open", server_default="open"
    )
    priority: Mapped[str | None] = mapped_column(String(20), nullable=True)
    category: Mapped[str | None] = mapped_column(String(255), nullable=True)
    team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="SET NULL"),
        nullable=True,
    )
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("team_members.id", ondelete="SET NULL"),
        nullable=True,
    )
    assignees: Mapped[list] = mapped_column(
        JSONB, server_default="[]", nullable=False
    )  # [{id, name, slack_user_id}]
    reported_by_slack_id: Mapped[str | None] = mapped_column(
        String(64), nullable=True
    )
    reported_by_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reported_by_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    slack_channel_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    slack_channel_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    slack_thread_ts: Mapped[str | None] = mapped_column(String(64), nullable=True)
    slack_message_ts: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ai_categorization: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    ai_rca: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    ai_provider_used: Mapped[str | None] = mapped_column(String(32), nullable=True)
    resolved_at: Mapped[str | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("team_members.id", ondelete="SET NULL"),
        nullable=True,
    )
    notifications_muted: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    last_reminder_sent_at: Mapped[str | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    created_at: Mapped[str] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[str] = mapped_column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    team = relationship("Team")
    assignee = relationship("TeamMember", foreign_keys=[assigned_to])
    resolver = relationship("TeamMember", foreign_keys=[resolved_by])
    history = relationship(
        "IssueHistory", back_populates="issue", cascade="all, delete-orphan"
    )
