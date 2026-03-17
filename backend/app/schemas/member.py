import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MemberBase(BaseModel):
    name: str
    slack_user_id: str
    email: str | None = None


class MemberCreate(BaseModel):
    name: str | None = None
    slack_user_id: str | None = None
    email: str | None = None
    role: str | None = None


class MemberUpdate(BaseModel):
    name: str | None = None
    slack_user_id: str | None = None
    email: str | None = None
    is_active: bool | None = None
    notifications_muted: bool | None = None
    role: str | None = None


class MemberResponse(MemberBase):
    id: uuid.UUID
    team_id: uuid.UUID
    role: str
    is_active: bool
    notifications_muted: bool
    open_issue_count: int
    total_assigned_count: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
