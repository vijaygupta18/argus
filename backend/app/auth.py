import jwt
from datetime import datetime, timezone, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User

security = HTTPBearer(auto_error=False)


class UserContext:
    """Represents the authenticated user."""

    def __init__(self, user: User, team_roles: dict[str, str]):
        self.user = user
        self.id = user.id
        self.email = user.email
        self.name = user.name
        self.slack_user_id = user.slack_user_id
        self.is_admin = user.is_admin
        self.team_roles = team_roles  # {team_id_str: "leader"|"worker"}

    def get_role_for_team(self, team_id) -> str | None:
        return self.team_roles.get(str(team_id))

    def is_leader_of(self, team_id) -> bool:
        return self.is_admin or self.get_role_for_team(team_id) == "leader"

    def is_member_of(self, team_id) -> bool:
        return str(team_id) in self.team_roles


def create_token(user: User, team_roles: dict) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.email,
        "name": user.name,
        "slack_id": user.slack_user_id,
        "is_admin": user.is_admin,
        "roles": team_roles,
        "iat": int(now.timestamp()),
        "exp": now + timedelta(hours=settings.jwt_expiry_hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> UserContext:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    email = payload.get("sub")
    stmt = select(User).where(User.email == email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # Trust JWT roles if token is fresh (< 1 hour old), otherwise refresh from DB.
    # Balances performance (no extra query on most requests) with security (stale roles caught within 1 hour).
    import time
    token_age_seconds = time.time() - payload.get("iat", 0)
    if token_age_seconds > 3600:  # older than 1 hour
        from app.models.team_member import TeamMember
        role_stmt = select(TeamMember.team_id, TeamMember.role).where(TeamMember.email == email)
        role_result = await db.execute(role_stmt)
        team_roles = {str(row.team_id): row.role for row in role_result.all()}
    else:
        team_roles = payload.get("roles", {})

    return UserContext(user=user, team_roles=team_roles)


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> UserContext | None:
    """Like get_current_user but returns None instead of 401 if not authenticated."""
    if credentials is None:
        return None
    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None


def require_admin(user: UserContext = Depends(get_current_user)) -> UserContext:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


def require_admin_or_leader(user: UserContext = Depends(get_current_user)) -> UserContext:
    if not user.is_admin and "leader" not in user.team_roles.values():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or team leader access required",
        )
    return user
