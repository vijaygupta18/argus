import uuid
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.team_member import TeamMember

logger = logging.getLogger(__name__)


async def assign_issue(db: AsyncSession, team_id: uuid.UUID) -> TeamMember | None:
    """
    Pick the team member with the lowest open_issue_count.
    Ties are broken by total_assigned_count (ascending).
    Returns None if no active members exist for the team.
    """
    stmt = (
        select(TeamMember)
        .where(TeamMember.team_id == team_id)
        .where(TeamMember.is_active.is_(True))
        .order_by(TeamMember.open_issue_count.asc(), TeamMember.total_assigned_count.asc())
        .limit(1)
    )

    result = await db.execute(stmt)
    member = result.scalar_one_or_none()

    if member is None:
        logger.warning(f"No active members found for team {team_id}")
        return None

    member.open_issue_count += 1
    member.total_assigned_count += 1
    await db.flush()

    logger.info(
        f"Assigned issue to member {member.name} (id={member.id}), "
        f"open_issue_count={member.open_issue_count}"
    )
    return member


async def release_assignment(db: AsyncSession, member_id: uuid.UUID) -> None:
    """Decrement open_issue_count when an issue is resolved/closed."""
    stmt = select(TeamMember).where(TeamMember.id == member_id)
    result = await db.execute(stmt)
    member = result.scalar_one_or_none()

    if member is None:
        logger.warning(f"Member {member_id} not found for release_assignment")
        return

    if member.open_issue_count > 0:
        member.open_issue_count -= 1
        await db.flush()

    logger.info(
        f"Released assignment for member {member.name} (id={member.id}), "
        f"open_issue_count={member.open_issue_count}"
    )
