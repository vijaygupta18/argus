import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator

VALID_STATUSES = {"open", "in_progress", "resolved", "closed"}
VALID_PRIORITIES = {"low", "medium", "high", "critical"}


class IssueBase(BaseModel):
    title: str
    description: str


class IssueCreate(BaseModel):
    title: str
    description: str
    priority: str | None = None
    team_id: uuid.UUID | None = None

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v):
        if v is not None and v not in VALID_PRIORITIES:
            raise ValueError(f"priority must be one of: {', '.join(sorted(VALID_PRIORITIES))}")
        return v


class AssigneeInfo(BaseModel):
    id: str
    name: str
    slack_user_id: str | None = None


class IssueUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    category: str | None = None
    team_id: uuid.UUID | None = None
    assigned_to: uuid.UUID | None = None
    assignees: list[AssigneeInfo] | None = None
    notifications_muted: bool | None = None
    reason: str | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(VALID_STATUSES))}")
        return v

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v):
        if v is not None and v not in VALID_PRIORITIES:
            raise ValueError(f"priority must be one of: {', '.join(sorted(VALID_PRIORITIES))}")
        return v


class IssueResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    status: str
    priority: str | None = None
    category: str | None = None
    team_id: uuid.UUID | None = None
    assigned_to: uuid.UUID | None = None
    assignees: list[dict] = []
    reported_by_slack_id: str | None = None
    reported_by_name: str | None = None
    reported_by_email: str | None = None
    slack_channel_id: str | None = None
    slack_channel_name: str | None = None
    slack_thread_ts: str | None = None
    slack_message_ts: str | None = None
    ai_categorization: dict[str, Any] | None = None
    ai_rca: dict[str, Any] | None = None
    ai_provider_used: str | None = None
    resolved_at: datetime | None = None
    resolved_by: uuid.UUID | None = None
    notifications_muted: bool
    last_reminder_sent_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    assignee_name: str | None = None
    team_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class IssueListItem(BaseModel):
    """Lightweight schema for issue list views -- omits large JSONB fields."""
    id: uuid.UUID
    title: str
    status: str
    priority: str | None = None
    category: str | None = None
    team_id: uuid.UUID | None = None
    assigned_to: uuid.UUID | None = None
    assignees: list[dict] = []
    reported_by_name: str | None = None
    created_at: datetime
    updated_at: datetime
    assignee_name: str | None = None
    team_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class IssueListResponse(BaseModel):
    items: list[IssueListItem]
    total: int
    page: int
    per_page: int


class IssueHistoryResponse(BaseModel):
    id: uuid.UUID
    issue_id: uuid.UUID
    action: str
    old_value: str | None = None
    new_value: str | None = None
    performed_by: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DashboardStats(BaseModel):
    total_issues: int
    open_issues: int
    in_progress_issues: int
    resolved_issues: int
    critical_issues: int
    avg_resolution_hours: float | None = None


class TeamStats(BaseModel):
    team_id: uuid.UUID
    team_name: str
    open_count: int
    resolved_count: int
    avg_resolution_hours: float | None = None


class ResolveRequest(BaseModel):
    reason: str  # REQUIRED - how they fixed it
    resolved_by: uuid.UUID | None = None
