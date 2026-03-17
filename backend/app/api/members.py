import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.team import Team
from app.models.team_member import TeamMember
from app.schemas.member import MemberCreate, MemberResponse, MemberUpdate
from app.auth import get_current_user, UserContext

logger = logging.getLogger(__name__)

# Router for team-scoped member operations
router = APIRouter(prefix="/api/teams/{team_id}/members", tags=["members"])

# Separate router for direct member operations (update/delete by member_id)
member_router = APIRouter(prefix="/api/members", tags=["members"])


@router.get("", response_model=list[MemberResponse])
async def list_members(
    team_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """List all members of a team."""
    # Verify team exists
    team_stmt = select(Team).where(Team.id == team_id)
    team_result = await db.execute(team_stmt)
    if team_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Team not found")

    stmt = (
        select(TeamMember)
        .where(TeamMember.team_id == team_id)
        .order_by(TeamMember.name)
    )
    result = await db.execute(stmt)
    members = result.scalars().all()
    return [MemberResponse.model_validate(m) for m in members]


@router.post("", response_model=MemberResponse, status_code=201)
async def add_member(
    team_id: uuid.UUID,
    data: MemberCreate,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Add a new member to a team. Admin or leader of this team."""
    if not user.is_leader_of(team_id):
        raise HTTPException(status_code=403, detail="Only admin or team leader can add members")

    # Verify team exists
    team_stmt = select(Team).where(Team.id == team_id)
    team_result = await db.execute(team_stmt)
    if team_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Team not found")

    slack_user_id = data.slack_user_id
    name = data.name
    email = data.email
    role = data.role or "worker"

    # Validate role
    if role not in ("leader", "worker"):
        raise HTTPException(status_code=400, detail="Role must be 'leader' or 'worker'")

    # Only admins can add members with leader role
    if role == "leader" and not user.is_admin:
        raise HTTPException(status_code=403, detail="Only admin can assign leader role")

    # Auto-resolve Slack user ID from email if not provided
    if not slack_user_id and email:
        from app.services.slack_service import slack_service
        user_info = await slack_service.lookup_by_email(email)
        if user_info:
            slack_user_id = user_info["id"]
            if not name or name == email:
                name = user_info["name"]
        else:
            raise HTTPException(status_code=400, detail=f"Could not find Slack user for email: {email}")

    # Auto-resolve name and email from Slack ID if we have one
    if slack_user_id and (not name or not email):
        from app.services.slack_service import slack_service
        user_info = await slack_service.get_user_info(slack_user_id)
        if not name:
            name = user_info.get("name", "Unknown")
        if not email:
            email = user_info.get("email")

    member = TeamMember(
        team_id=team_id,
        name=name,
        slack_user_id=slack_user_id or "",
        email=email,
        role=role,
    )
    db.add(member)
    await db.flush()

    logger.info(f"Added member {member.name} (role={role}) to team {team_id} (id={member.id}, slack={slack_user_id}) by {user.email}")
    return MemberResponse.model_validate(member)


@member_router.get("/{member_id}", response_model=MemberResponse)
async def get_member(
    member_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Get a single member by ID."""
    stmt = select(TeamMember).where(TeamMember.id == member_id)
    result = await db.execute(stmt)
    member = result.scalar_one_or_none()

    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")

    return MemberResponse.model_validate(member)


@member_router.patch("/{member_id}", response_model=MemberResponse)
async def update_member(
    member_id: uuid.UUID,
    data: MemberUpdate,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Update a team member. Admin or leader of member's team."""
    stmt = select(TeamMember).where(TeamMember.id == member_id)
    result = await db.execute(stmt)
    member = result.scalar_one_or_none()

    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")

    # Check permission: admin or leader of the member's team
    if not user.is_leader_of(member.team_id):
        raise HTTPException(status_code=403, detail="Only admin or team leader can update members")

    update_data = data.model_dump(exclude_unset=True)

    # Role change permission checks
    if "role" in update_data:
        new_role = update_data["role"]
        if new_role not in ("leader", "worker"):
            raise HTTPException(status_code=400, detail="Role must be 'leader' or 'worker'")
        # Only admin can set role to "leader"
        if new_role == "leader" and not user.is_admin:
            raise HTTPException(status_code=403, detail="Only admin can assign leader role")
        # Leaders can only set role to "worker"
        if new_role != "worker" and not user.is_admin:
            raise HTTPException(status_code=403, detail="Leaders can only assign worker role")

    for field, value in update_data.items():
        setattr(member, field, value)

    await db.flush()
    logger.info(f"Updated member {member_id}: fields={list(update_data.keys())} by {user.email}")
    return MemberResponse.model_validate(member)


@member_router.delete("/{member_id}", status_code=204)
async def delete_member(
    member_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Delete a team member. Admin or leader of member's team."""
    stmt = select(TeamMember).where(TeamMember.id == member_id)
    result = await db.execute(stmt)
    member = result.scalar_one_or_none()

    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")

    # Check permission: admin or leader of the member's team
    if not user.is_leader_of(member.team_id):
        raise HTTPException(status_code=403, detail="Only admin or team leader can delete members")

    await db.delete(member)
    await db.flush()
    logger.info(f"Deleted member {member_id}: {member.name} by {user.email}")
