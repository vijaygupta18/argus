import logging

from fastapi import APIRouter, Depends
from sqlalchemy import case, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.issue import Issue
from app.models.team import Team
from app.schemas.issue import DashboardStats, TeamStats
from app.auth import get_current_user, UserContext

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Get overall dashboard statistics."""
    # Total issues count
    total_stmt = select(func.count(Issue.id))
    total_result = await db.execute(total_stmt)
    total_issues = total_result.scalar() or 0

    # Count by status
    status_stmt = select(
        Issue.status,
        func.count(Issue.id),
    ).group_by(Issue.status)
    status_result = await db.execute(status_stmt)
    status_counts = {row[0]: row[1] for row in status_result.all()}

    open_issues = status_counts.get("open", 0)
    in_progress_issues = status_counts.get("in_progress", 0)
    resolved_issues = status_counts.get("resolved", 0) + status_counts.get("closed", 0)

    # Critical issues (open or in_progress)
    critical_stmt = select(func.count(Issue.id)).where(
        Issue.priority == "critical",
        Issue.status.in_(["open", "in_progress"]),
    )
    critical_result = await db.execute(critical_stmt)
    critical_issues = critical_result.scalar() or 0

    # Average resolution time in hours (for resolved issues with resolved_at)
    avg_stmt = select(
        func.avg(
            extract("epoch", Issue.resolved_at) - extract("epoch", Issue.created_at)
        )
    ).where(
        Issue.resolved_at.isnot(None),
    )
    avg_result = await db.execute(avg_stmt)
    avg_seconds = avg_result.scalar()
    avg_resolution_hours = round(avg_seconds / 3600, 1) if avg_seconds else None

    return DashboardStats(
        total_issues=total_issues,
        open_issues=open_issues,
        in_progress_issues=in_progress_issues,
        resolved_issues=resolved_issues,
        critical_issues=critical_issues,
        avg_resolution_hours=avg_resolution_hours,
    )


@router.get("/team-stats", response_model=list[TeamStats])
async def get_team_stats(
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Get per-team statistics."""
    # Get all teams with their issue counts
    stmt = (
        select(
            Team.id,
            Team.name,
            func.count(
                case(
                    (Issue.status.in_(["open", "in_progress"]), Issue.id),
                )
            ).label("open_count"),
            func.count(
                case(
                    (Issue.status.in_(["resolved", "closed"]), Issue.id),
                )
            ).label("resolved_count"),
            func.avg(
                case(
                    (
                        Issue.resolved_at.isnot(None),
                        extract("epoch", Issue.resolved_at)
                        - extract("epoch", Issue.created_at),
                    ),
                )
            ).label("avg_resolution_seconds"),
        )
        .outerjoin(Issue, Team.id == Issue.team_id)
        .group_by(Team.id, Team.name)
        .order_by(Team.name)
    )

    result = await db.execute(stmt)
    rows = result.all()

    team_stats = []
    for row in rows:
        avg_seconds = row.avg_resolution_seconds
        avg_hours = round(avg_seconds / 3600, 1) if avg_seconds else None

        team_stats.append(
            TeamStats(
                team_id=row.id,
                team_name=row.name,
                open_count=row.open_count,
                resolved_count=row.resolved_count,
                avg_resolution_hours=avg_hours,
            )
        )

    return team_stats
