import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.models.team import Team
from app.schemas.team import TeamCreate, TeamResponse, TeamUpdate, TeamWithMembers
from app.auth import get_current_user, require_admin, UserContext

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.get("", response_model=list[TeamResponse])
async def list_teams(
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """List all teams."""
    stmt = select(Team).order_by(Team.name)
    result = await db.execute(stmt)
    teams = result.scalars().all()
    return [TeamResponse.model_validate(t) for t in teams]


@router.post("", response_model=TeamResponse, status_code=201)
async def create_team(
    data: TeamCreate,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(require_admin),
):
    """Create a new team. Admin only."""
    team = Team(
        name=data.name,
        description=data.description,
    )
    db.add(team)
    await db.flush()
    await db.refresh(team)

    logger.info(f"Created team: {team.name} (id={team.id}) by {user.email}")
    return TeamResponse.model_validate(team)


@router.get("/{team_id}", response_model=TeamWithMembers)
async def get_team(
    team_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Get a team with its members."""
    stmt = (
        select(Team)
        .options(joinedload(Team.members))
        .where(Team.id == team_id)
    )
    result = await db.execute(stmt)
    team = result.unique().scalar_one_or_none()

    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")

    return TeamWithMembers.model_validate(team)


@router.patch("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: uuid.UUID,
    data: TeamUpdate,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Update team settings. Admin or leader of this team."""
    if not user.is_leader_of(team_id):
        raise HTTPException(status_code=403, detail="Only admin or team leader can update team settings")

    stmt = select(Team).where(Team.id == team_id)
    result = await db.execute(stmt)
    team = result.scalar_one_or_none()

    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(team, field, value)

    await db.flush()
    await db.refresh(team)
    logger.info(f"Updated team {team_id}: fields={list(update_data.keys())} by {user.email}")
    return TeamResponse.model_validate(team)


@router.delete("/{team_id}", status_code=204)
async def delete_team(
    team_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(require_admin),
):
    """Delete a team and cascade to members. Admin only."""
    stmt = select(Team).where(Team.id == team_id)
    result = await db.execute(stmt)
    team = result.scalar_one_or_none()

    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")

    await db.delete(team)
    await db.flush()
    logger.info(f"Deleted team {team_id}: {team.name} by {user.email}")
