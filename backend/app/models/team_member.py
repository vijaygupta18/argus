import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class TeamMember(Base):
    __tablename__ = "team_members"
    __table_args__ = (
        CheckConstraint(
            "role IN ('manager', 'agent')",
            name="ck_team_members_role",
        ),
        UniqueConstraint("team_id", "email", name="uq_team_members_team_id_email"),
        Index("ix_team_members_email", "email"),
        Index("ix_team_members_team_id_is_active", "team_id", "is_active"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slack_user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    notifications_muted: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    role: Mapped[str] = mapped_column(
        String(20), default="agent", server_default="agent", nullable=False
    )
    open_issue_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0"
    )
    total_assigned_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0"
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

    team = relationship("Team", back_populates="members")
