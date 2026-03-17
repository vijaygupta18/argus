import uuid
import logging
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.issue import Issue
from app.models.issue_history import IssueHistory
from app.schemas.issue import IssueUpdate

logger = logging.getLogger(__name__)


async def create_issue(
    db: AsyncSession,
    title: str,
    description: str,
    status: str = "open",
    priority: str | None = None,
    category: str | None = None,
    team_id: uuid.UUID | None = None,
    assigned_to: uuid.UUID | None = None,
    reported_by_slack_id: str | None = None,
    reported_by_name: str | None = None,
    reported_by_email: str | None = None,
    slack_channel_id: str | None = None,
    slack_channel_name: str | None = None,
    slack_thread_ts: str | None = None,
    slack_message_ts: str | None = None,
    ai_categorization: dict | None = None,
    ai_rca: dict | None = None,
    ai_provider_used: str | None = None,
) -> Issue:
    """Create a new issue and add creation history."""
    issue = Issue(
        title=title,
        description=description,
        status=status,
        priority=priority,
        category=category,
        team_id=team_id,
        assigned_to=assigned_to,
        reported_by_slack_id=reported_by_slack_id,
        reported_by_name=reported_by_name,
        reported_by_email=reported_by_email,
        slack_channel_id=slack_channel_id,
        slack_channel_name=slack_channel_name,
        slack_thread_ts=slack_thread_ts,
        slack_message_ts=slack_message_ts,
        ai_categorization=ai_categorization,
        ai_rca=ai_rca,
        ai_provider_used=ai_provider_used,
    )

    db.add(issue)
    await db.flush()

    reporter = reported_by_name or "system"
    await add_history(db, issue.id, action="created", new_value=title, performed_by=reporter)

    if assigned_to:
        # Resolve assignee name for history
        from app.models.team_member import TeamMember
        stmt = select(TeamMember).where(TeamMember.id == assigned_to)
        result = await db.execute(stmt)
        assignee = result.scalar_one_or_none()
        assignee_name = assignee.name if assignee else str(assigned_to)

        await add_history(
            db,
            issue.id,
            action="assigned",
            new_value=assignee_name,
            performed_by=reporter,
        )

    logger.info(f"Created issue {issue.id}: {title}")
    return issue


async def update_issue(
    db: AsyncSession, issue_id: uuid.UUID, updates: IssueUpdate,
    performed_by: str | None = None,
) -> Issue:
    """Update an issue and track changes in history."""
    stmt = select(Issue).where(Issue.id == issue_id)
    result = await db.execute(stmt)
    issue = result.scalar_one_or_none()

    if issue is None:
        raise ValueError(f"Issue {issue_id} not found")

    actor = performed_by or "api"
    update_data = updates.model_dump(exclude_unset=True)

    for field, new_value in update_data.items():
        old_value = getattr(issue, field, None)

        # Convert UUIDs to strings for comparison and history
        old_str = str(old_value) if old_value is not None else None
        new_str = str(new_value) if new_value is not None else None

        if old_str != new_str:
            setattr(issue, field, new_value)

            # Resolve to readable names for history
            display_old = old_str
            display_new = new_str
            if field in ("assigned_to", "team_id", "resolved_by"):
                from app.models.team_member import TeamMember
                from app.models.team import Team
                model = Team if field == "team_id" else TeamMember
                if old_value:
                    r = await db.execute(select(model).where(model.id == old_value))
                    obj = r.scalar_one_or_none()
                    display_old = obj.name if obj else old_str
                if new_value:
                    r = await db.execute(select(model).where(model.id == new_value))
                    obj = r.scalar_one_or_none()
                    display_new = obj.name if obj else new_str
            elif field == "assignees":
                # Extract just names from the assignees list
                def _names(val):
                    if isinstance(val, list):
                        names = [a.get("name") or a.get("id", "?") for a in val if isinstance(a, dict)]
                        return ", ".join(names) if names else "None"
                    return "None"
                display_old = _names(old_value)
                display_new = _names(new_value)
            await add_history(
                db,
                issue_id,
                action=f"updated_{field}",
                old_value=display_old,
                new_value=display_new,
                performed_by=actor,
            )

    await db.flush()
    logger.info(f"Updated issue {issue_id}: fields={list(update_data.keys())} by {actor}")
    return issue


async def resolve_issue(
    db: AsyncSession,
    issue_id: uuid.UUID,
    resolved_by_id: uuid.UUID | None = None,
    notes: str | None = None,
    performed_by: str | None = None,
) -> Issue:
    """Mark an issue as resolved."""
    stmt = (
        select(Issue)
        .options(joinedload(Issue.assignee))
        .where(Issue.id == issue_id)
    )
    result = await db.execute(stmt)
    issue = result.unique().scalar_one_or_none()

    if issue is None:
        raise ValueError(f"Issue {issue_id} not found")

    actor = performed_by or (str(resolved_by_id) if resolved_by_id else "api")

    old_status = issue.status
    issue.status = "resolved"
    issue.resolved_at = datetime.now(timezone.utc)
    issue.resolved_by = resolved_by_id

    await add_history(
        db,
        issue_id,
        action="resolved",
        old_value=old_status,
        new_value="resolved",
        performed_by=actor,
    )

    if notes:
        await add_history(
            db,
            issue_id,
            action="resolution_notes",
            new_value=notes,
            performed_by=actor,
        )

    await db.flush()
    logger.info(f"Resolved issue {issue_id} by {actor}")
    return issue


async def get_issue_with_details(db: AsyncSession, issue_id: uuid.UUID) -> Issue | None:
    """Get an issue with team, assignee, and resolver eagerly loaded."""
    stmt = (
        select(Issue)
        .options(
            joinedload(Issue.team),
            joinedload(Issue.assignee),
            joinedload(Issue.resolver),
        )
        .where(Issue.id == issue_id)
    )
    result = await db.execute(stmt)
    return result.unique().scalar_one_or_none()


async def list_issues(
    db: AsyncSession,
    status: str | None = None,
    priority: str | None = None,
    team_id: uuid.UUID | None = None,
    assigned_to: uuid.UUID | None = None,
    reported_by_email: str | None = None,
    search: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[Issue], int]:
    """
    List issues with filters, search, and pagination.
    Returns (issues, total_count).
    """
    base_stmt = select(Issue)
    count_stmt = select(func.count(Issue.id))

    if status:
        base_stmt = base_stmt.where(Issue.status == status)
        count_stmt = count_stmt.where(Issue.status == status)

    if priority:
        base_stmt = base_stmt.where(Issue.priority == priority)
        count_stmt = count_stmt.where(Issue.priority == priority)

    if team_id:
        base_stmt = base_stmt.where(Issue.team_id == team_id)
        count_stmt = count_stmt.where(Issue.team_id == team_id)

    if assigned_to:
        base_stmt = base_stmt.where(Issue.assigned_to == assigned_to)
        count_stmt = count_stmt.where(Issue.assigned_to == assigned_to)

    if reported_by_email:
        base_stmt = base_stmt.where(Issue.reported_by_email == reported_by_email)
        count_stmt = count_stmt.where(Issue.reported_by_email == reported_by_email)

    if search:
        search_filter = f"%{search}%"
        from sqlalchemy import or_
        search_cond = or_(
            Issue.title.ilike(search_filter),
            Issue.description.ilike(search_filter),
            Issue.category.ilike(search_filter),
            Issue.reported_by_name.ilike(search_filter),
        )
        base_stmt = base_stmt.where(search_cond)
        count_stmt = count_stmt.where(search_cond)

    # Get total count
    count_result = await db.execute(count_stmt)
    total = count_result.scalar()

    # Get paginated results
    offset = (page - 1) * per_page
    items_stmt = (
        base_stmt.options(
            joinedload(Issue.team),
            joinedload(Issue.assignee),
        )
        .order_by(Issue.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    result = await db.execute(items_stmt)
    issues = list(result.unique().scalars().all())

    return issues, total


async def add_history(
    db: AsyncSession,
    issue_id: uuid.UUID,
    action: str,
    old_value: str | None = None,
    new_value: str | None = None,
    performed_by: str | None = None,
) -> IssueHistory:
    """Add an entry to the issue history log."""
    history = IssueHistory(
        issue_id=issue_id,
        action=action,
        old_value=old_value,
        new_value=new_value,
        performed_by=performed_by,
    )
    db.add(history)
    await db.flush()
    return history
