import logging
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import UserContext, create_token, get_current_user
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.team_member import TeamMember

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


class GoogleCallbackRequest(BaseModel):
    code: str


async def _login_user(email: str, name: str | None, db: AsyncSession) -> dict:
    """Shared login logic: find or create user, resolve Slack, issue JWT."""
    email = email.strip().lower()

    stmt = select(User).where(User.email == email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        slack_info = None
        try:
            from app.services.slack_service import slack_service
            slack_info = await slack_service.lookup_by_email(email)
        except Exception:
            logger.warning(f"Could not look up Slack info for {email}")

        user = User(
            email=email,
            name=name or (slack_info["name"] if slack_info else email.split("@")[0]),
            slack_user_id=slack_info["id"] if slack_info else None,
            is_admin=email in settings.admin_email_list,
        )
        db.add(user)
    else:
        if name and user.name != name:
            user.name = name

    user.last_login_at = datetime.now(timezone.utc)
    user.is_admin = email in settings.admin_email_list
    await db.flush()

    stmt = select(TeamMember).where(TeamMember.email == email)
    result = await db.execute(stmt)
    members = result.scalars().all()
    team_roles = {str(m.team_id): m.role for m in members}

    token = create_token(user, team_roles)

    return {
        "token": token,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "slack_user_id": user.slack_user_id,
            "is_admin": user.is_admin,
            "roles": team_roles,
        },
    }


@router.get("/google/url")
async def google_auth_url():
    """Get the Google OAuth URL to redirect the user to."""
    if not settings.google_client_id:
        raise HTTPException(status_code=400, detail="Google OAuth not configured")

    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    return {"url": f"{GOOGLE_AUTH_URL}?{urlencode(params)}"}


@router.post("/google/callback")
async def google_callback(body: GoogleCallbackRequest, db: AsyncSession = Depends(get_db)):
    """Exchange Google auth code for user info and issue JWT."""
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=400, detail="Google OAuth not configured")

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": body.code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )

    if token_resp.status_code != 200:
        logger.error(f"Google token exchange failed: {token_resp.text}")
        raise HTTPException(status_code=400, detail="Failed to authenticate with Google")

    token_data = token_resp.json()
    access_token = token_data.get("access_token")

    if not access_token:
        raise HTTPException(status_code=400, detail="No access token from Google")

    # Get user info
    async with httpx.AsyncClient() as client:
        userinfo_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if userinfo_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to get user info from Google")

    google_user = userinfo_resp.json()
    email = google_user.get("email")
    name = google_user.get("name")

    if not email:
        raise HTTPException(status_code=400, detail="No email from Google")

    logger.info(f"Google login: {email} ({name})")
    return await _login_user(email, name, db)


@router.get("/me")
async def get_me(user: UserContext = Depends(get_current_user)):
    """Get current user info."""
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "slack_user_id": user.slack_user_id,
        "is_admin": user.is_admin,
        "roles": user.team_roles,
    }
