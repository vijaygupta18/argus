import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.member import MemberResponse


class TeamBase(BaseModel):
    name: str
    description: str | None = None


class TeamCreate(TeamBase):
    reminder_frequency_minutes: int | None = None
    reminder_start_hour: int | None = None
    notifications_enabled: bool | None = None


class TeamUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    reminder_frequency_minutes: int | None = None
    reminder_start_hour: int | None = None
    notifications_enabled: bool | None = None

    @field_validator("reminder_start_hour")
    @classmethod
    def validate_start_hour(cls, v):
        if v is not None and not (0 <= v <= 23):
            raise ValueError("reminder_start_hour must be between 0 and 23")
        return v

    @field_validator("reminder_frequency_minutes")
    @classmethod
    def validate_frequency(cls, v):
        if v is not None and v < 1:
            raise ValueError("reminder_frequency_minutes must be at least 1")
        return v


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
