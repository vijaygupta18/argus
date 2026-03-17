import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.member import MemberResponse


class TeamBase(BaseModel):
    name: str
    description: str | None = None


class TeamCreate(TeamBase):
    pass


class TeamUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    reminder_frequency_minutes: int | None = None
    reminder_start_hour: int | None = None
    notifications_enabled: bool | None = None


class TeamResponse(TeamBase):
    id: uuid.UUID
    reminder_frequency_minutes: int
    reminder_start_hour: int
    notifications_enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TeamWithMembers(TeamResponse):
    members: list[MemberResponse] = []
