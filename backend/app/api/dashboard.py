import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.issue import Issue
from app.models.issue_history import IssueHistory
from app.models.team import Team
from app.schemas.issue import DashboardStats, TeamStats, IssueHistoryResponse
from app.auth import get_current_user, UserContext

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Get overall dashboard statistics in a single query."""
    # Combine all dashboard stats into one query using conditional aggregation
    stmt = select(
        func.count(Issue.id).label("total"),
        func.count(case((Issue.status == "open", Issue.id))).label("open"),
        func.count(case((Issue.status == "in_progress", Issue.id))).label("in_progress"),
        func.count(
            case((Issue.status.in_(["resolved", "closed"]), Issue.id))
        ).label("resolved"),
        func.count(
            case(
                (
                    (Issue.priority == "critical")
                    & Issue.status.in_(["open", "in_progress"]),
                    Issue.id,
                )
            )
        ).label("critical"),
        func.avg(
            case(
                (
                    Issue.resolved_at.isnot(None),
                    extract("epoch", Issue.resolved_at)
                    - extract("epoch", Issue.created_at),
                )
            )
        ).label("avg_resolution_seconds"),
    )

    result = await db.execute(stmt)
    row = result.one()

    avg_seconds = row.avg_resolution_seconds
    avg_resolution_hours = round(avg_seconds / 3600, 1) if avg_seconds else None

    return DashboardStats(
        total_issues=row.total,
        open_issues=row.open,
        in_progress_issues=row.in_progress,
        resolved_issues=row.resolved,
        critical_issues=row.critical,
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


@router.get("/recent-activity", response_model=list[IssueHistoryResponse])
async def get_recent_activity(
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Get the most recent activity across all issues."""
    stmt = (
        select(IssueHistory)
        .order_by(IssueHistory.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    entries = result.scalars().all()
    return [IssueHistoryResponse.model_validate(e) for e in entries]
