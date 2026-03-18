import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update, or_, cast, Text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, async_session_maker
from app.models.issue import Issue
from app.models.issue_history import IssueHistory
from app.models.team_member import TeamMember
from app.schemas.issue import (
    IssueCreate,
    IssueHistoryResponse,
    IssueListItem,
    IssueListResponse,
    IssueResponse,
    IssueUpdate,
    ResolveRequest,
)
from app.services import issue_service
from app.services.ai_service import ai_service
from app.services.slack_service import slack_service
from app.config import settings
from app.auth import get_current_user, UserContext

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/issues", tags=["issues"])

# Hold references to background tasks to prevent garbage collection
_background_tasks: set = set()


def _issue_to_response(issue: Issue) -> IssueResponse:
    """Convert an Issue model to IssueResponse, including relationship names."""
    assignee_name = None
    if issue.assignee:
        assignee_name = issue.assignee.name

    team_name = None
    if issue.team:
        team_name = issue.team.name

    return IssueResponse(
        id=issue.id,
        title=issue.title,
        description=issue.description,
        status=issue.status,
        priority=issue.priority,
        category=issue.category,
        team_id=issue.team_id,
        assigned_to=issue.assigned_to,
        assignees=issue.assignees or [],
        reported_by_slack_id=issue.reported_by_slack_id,
        reported_by_name=issue.reported_by_name,
        reported_by_email=issue.reported_by_email,
        slack_channel_id=issue.slack_channel_id,
        slack_channel_name=issue.slack_channel_name,
        slack_thread_ts=issue.slack_thread_ts,
        slack_message_ts=issue.slack_message_ts,
        ai_categorization=issue.ai_categorization,
        ai_rca=issue.ai_rca,
        ai_provider_used=issue.ai_provider_used,
        resolved_at=issue.resolved_at,
        resolved_by=issue.resolved_by,
        notifications_muted=issue.notifications_muted,
        last_reminder_sent_at=issue.last_reminder_sent_at,
        created_at=issue.created_at,
        updated_at=issue.updated_at,
        assignee_name=assignee_name,
        team_name=team_name,
    )


async def _is_issue_assigned_to_user(issue: Issue, user: UserContext, db: AsyncSession) -> bool:
    """Check if the issue is assigned to a team member whose email matches the user."""
    # Check primary assignee
    if issue.assigned_to:
        stmt = select(TeamMember).where(TeamMember.id == issue.assigned_to)
        result = await db.execute(stmt)
        assignee = result.scalar_one_or_none()
        if assignee and assignee.email == user.email:
            return True
    # Check multi-assignees JSONB array
    for a in (issue.assignees or []):
        if not isinstance(a, dict):
            continue
        # Match by slack_user_id only when both are non-empty (avoids None == None false match)
        if user.slack_user_id and a.get("slack_user_id") and a.get("slack_user_id") == user.slack_user_id:
            return True
        # Name fallback for users without Slack ID
        if a.get("name") and user.name and a.get("name") == user.name:
            return True
    return False


def _issue_to_list_item(issue: Issue) -> IssueListItem:
    """Convert an Issue model to a lightweight IssueListItem for list views."""
    return IssueListItem(
        id=issue.id,
        title=issue.title,
        status=issue.status,
        priority=issue.priority,
        category=issue.category,
        team_id=issue.team_id,
        assigned_to=issue.assigned_to,
        assignees=issue.assignees or [],
        reported_by_name=issue.reported_by_name,
        created_at=issue.created_at,
        updated_at=issue.updated_at,
        assignee_name=issue.assignee.name if issue.assignee else None,
        team_name=issue.team.name if issue.team else None,
    )


@router.get("", response_model=IssueListResponse)
async def list_issues(
    status: str | None = Query(None, description="Filter by status"),
    priority: str | None = Query(None, description="Filter by priority"),
    team_id: uuid.UUID | None = Query(None, description="Filter by team ID"),
    assigned_to: uuid.UUID | None = Query(None, description="Filter by assignee ID"),
    reported_by_email: str | None = Query(None, description="Filter by reporter email"),
    mine: bool = Query(False, description="Show only issues assigned to current user"),
    search: str | None = Query(None, description="Search title, description, category, reporter"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """List issues with optional filters, search, and pagination."""
    # If mine=true, find ALL the user's team member IDs and filter by any of them
    my_member_ids: list[uuid.UUID] | None = None
    if mine and not assigned_to:
        stmt = select(TeamMember.id).where(TeamMember.email == user.email)
        result = await db.execute(stmt)
        my_member_ids = [row[0] for row in result.all()]
        if not my_member_ids:
            # User has no team memberships — return empty results
            return IssueListResponse(items=[], total=0, page=page, per_page=per_page)

    issues, total = await issue_service.list_issues(
        db,
        status=status,
        priority=priority,
        team_id=team_id,
        assigned_to=assigned_to,
        assigned_to_any=my_member_ids,
        reported_by_email=reported_by_email,
        search=search,
        page=page,
        per_page=per_page,
    )

    items = [_issue_to_list_item(issue) for issue in issues]

    return IssueListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
    )


async def _generate_rca_background(issue_id: uuid.UUID, title: str, description: str, category: str, team_name: str):
    """Generate RCA in background and save to DB. Supports Vishwakarma streaming with live progress."""
    try:
        # Pass issue_id and session maker so Vishwakarma can save live progress
        rca = await ai_service.generate_rca(
            issue_title=title,
            issue_description=description,
            category=category,
            team_name=team_name,
            issue_id=issue_id,
            db_session_maker=async_session_maker,
        )
        async with async_session_maker() as db:
            stmt = select(Issue).where(Issue.id == issue_id)
            result = await db.execute(stmt)
            issue = result.scalar_one_or_none()
            if issue:
                issue.ai_rca = rca
                issue.ai_provider_used = "vishwakarma" if rca.get("source") == "vishwakarma" else settings.ai_provider
                await db.commit()
                logger.info(f"Background RCA generated for issue {issue_id}")
    except Exception as e:
        logger.error(f"Background RCA generation failed for {issue_id}: {e}")
        # Reset ai_rca to NULL so next view retries
        try:
            async with async_session_maker() as db:
                stmt = select(Issue).where(Issue.id == issue_id)
                result = await db.execute(stmt)
                issue = result.scalar_one_or_none()
                if issue:
                    issue.ai_rca = None
                    await db.commit()
        except Exception:
            pass


@router.get("/{issue_id}", response_model=IssueResponse)
async def get_issue(
    issue_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Get a single issue with details. Triggers RCA generation in background if not yet available."""
    issue = await issue_service.get_issue_with_details(db, issue_id)

    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")

    # Kick off RCA in background — only once (guard: atomic CAS)
    # Also retry if stuck in "investigating" for > 15 minutes (background task died)
    should_generate_rca = False
    if issue.ai_rca is None and settings.ai_api_key:
        should_generate_rca = True
    elif isinstance(issue.ai_rca, dict) and issue.ai_rca.get("status") == "investigating" and settings.ai_api_key:
        # Check if stuck — updated_at hasn't changed in 15 minutes
        from datetime import datetime, timezone, timedelta
        if issue.updated_at:
            updated = issue.updated_at if hasattr(issue.updated_at, 'tzinfo') else datetime.fromisoformat(str(issue.updated_at))
            if hasattr(updated, 'tzinfo') and updated.tzinfo is None:
                updated = updated.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) - updated > timedelta(minutes=15):
                should_generate_rca = True
                logger.warning(f"RCA stuck in investigating for issue {issue_id}, retrying")

    if should_generate_rca:
        import asyncio
        # Use a fresh session to atomically mark as investigating — avoids duplicate RCA generation
        # Must handle both SQL NULL and JSON null (asyncpg returns None for both but IS NULL is False for JSON null)
        async with async_session_maker() as guard_session:
            result = await guard_session.execute(
                update(Issue)
                .where(Issue.id == issue.id, or_(Issue.ai_rca.is_(None), cast(Issue.ai_rca, Text) == "null"))
                .values(ai_rca={"status": "investigating"})
            )
            await guard_session.commit()
        # Only spawn background task if we won the race (rowcount == 1)
        if result.rowcount == 1:
            team_name = issue.team.name if issue.team else "Unknown"
            task = asyncio.create_task(_generate_rca_background(
                issue.id, issue.title, issue.description, issue.category or "other", team_name
            ))
            _background_tasks.add(task)
            task.add_done_callback(_background_tasks.discard)

    return _issue_to_response(issue)


@router.post("", response_model=IssueResponse, status_code=201)
async def create_issue(
    data: IssueCreate,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Create a new issue via API. Readers cannot create."""
    if not user.is_admin and not user.team_roles:
        raise HTTPException(status_code=403, detail="Readers cannot create issues")
    issue = await issue_service.create_issue(
        db,
        title=data.title,
        description=data.description,
        priority=data.priority,
        team_id=data.team_id,
        reported_by_name=user.name,
        reported_by_slack_id=user.slack_user_id,
        reported_by_email=user.email,
    )

    # Reload with relationships
    created = await issue_service.get_issue_with_details(db, issue.id)
    return _issue_to_response(created)


@router.patch("/{issue_id}", response_model=IssueResponse)
async def update_issue(
    issue_id: uuid.UUID,
    data: IssueUpdate,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Update an issue with role-based permission checks."""
    # Get old issue before update
    old_issue = await issue_service.get_issue_with_details(db, issue_id)
    if old_issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    old_status = old_issue.status
    old_assigned_to_id = str(old_issue.assigned_to) if old_issue.assigned_to else ""
    # Build old assignee display from assignees array or primary assignee
    old_assignees_list = old_issue.assignees or []
    if old_assignees_list:
        old_assignee_name = ", ".join(a.get("name", "?") for a in old_assignees_list if isinstance(a, dict))
    elif old_issue.assignee:
        old_assignee_name = old_issue.assignee.name
    else:
        old_assignee_name = None

    update_data = data.model_dump(exclude_unset=True)

    # --- Permission checks ---
    if not user.is_admin:
        is_leader_of_issue_team = old_issue.team_id and user.is_leader_of(old_issue.team_id)
        is_assigned_to_user = await _is_issue_assigned_to_user(old_issue, user, db)

        if is_leader_of_issue_team:
            # Leaders can update issues assigned to their team - all fields allowed
            pass
        elif is_assigned_to_user:
            # Workers can only change status of issues assigned to them
            allowed_fields = {"status", "reason"}
            disallowed = set(update_data.keys()) - allowed_fields
            if disallowed:
                raise HTTPException(
                    status_code=403,
                    detail=f"Workers can only change issue status. Cannot update: {', '.join(disallowed)}",
                )
        else:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to update this issue",
            )

    # --- Status-specific checks ---
    new_status = data.status

    # If closing, require a reason
    if new_status == "closed":
        reason = update_data.get("reason")
        if not reason:
            raise HTTPException(
                status_code=400,
                detail="A reason is required when closing an issue",
            )
        # Only admin or leader can close
        if not user.is_admin:
            is_leader_of_issue_team = old_issue.team_id and user.is_leader_of(old_issue.team_id)
            if not is_leader_of_issue_team:
                raise HTTPException(
                    status_code=403,
                    detail="Only admin or team leader can close issues",
                )

    # --- Validate assignees are not leaders ---
    if "assigned_to" in update_data and update_data["assigned_to"]:
        stmt = select(TeamMember).where(TeamMember.id == update_data["assigned_to"])
        r = await db.execute(stmt)
        m = r.scalar_one_or_none()
        if m and m.role == "leader":
            raise HTTPException(status_code=400, detail=f"{m.name} is a team leader and cannot be assigned issues")

    if "assignees" in update_data and update_data["assignees"]:
        leader_names = []
        for a in update_data["assignees"]:
            aid = a.get("id") if isinstance(a, dict) else getattr(a, "id", None)
            if aid:
                stmt = select(TeamMember).where(TeamMember.id == uuid.UUID(str(aid)))
                r = await db.execute(stmt)
                m = r.scalar_one_or_none()
                if m and m.role == "leader":
                    leader_names.append(m.name)
        if leader_names:
            raise HTTPException(status_code=400, detail=f"{', '.join(leader_names)} are team leaders and cannot be assigned issues")

    # Strip 'reason' from update_data before passing to issue_service (it's not a model field)
    reason_text = update_data.pop("reason", None)

    # Build an IssueUpdate without the reason field for the service
    service_updates = IssueUpdate(**{k: v for k, v in update_data.items()})

    try:
        issue = await issue_service.update_issue(db, issue_id, service_updates, performed_by=user.name)
    except ValueError:
        raise HTTPException(status_code=404, detail="Issue not found")

    # --- Adjust open_issue_count for assignment changes ---
    from app.services.assignment_service import release_assignment

    # Handle primary assignee change
    new_assigned_to_id = str(issue.assigned_to) if issue.assigned_to else ""
    if old_assigned_to_id and old_assigned_to_id != new_assigned_to_id:
        # Old primary assignee lost assignment -> decrement
        try:
            await release_assignment(db, uuid.UUID(old_assigned_to_id))
        except Exception as e:
            logger.warning(f"Failed to release old assignee {old_assigned_to_id}: {e}")
    if new_assigned_to_id and old_assigned_to_id != new_assigned_to_id:
        # New primary assignee gained assignment -> increment
        stmt = select(TeamMember).where(TeamMember.id == issue.assigned_to)
        r = await db.execute(stmt)
        new_member = r.scalar_one_or_none()
        if new_member:
            new_member.open_issue_count += 1
            new_member.total_assigned_count += 1
            await db.flush()

    # Handle secondary assignees change
    if "assignees" in update_data:
        old_assignee_ids = {a.get("id") for a in (old_issue.assignees or []) if isinstance(a, dict) and a.get("id")}
        new_assignee_ids = set()
        for a in (update_data["assignees"] or []):
            if isinstance(a, dict):
                new_assignee_ids.add(a.get("id"))
            elif hasattr(a, "id"):
                new_assignee_ids.add(a.id)
        new_assignee_ids.discard(None)

        # Decrement for removed secondary assignees (skip primary, handled above)
        for removed_id in old_assignee_ids - new_assignee_ids:
            if removed_id != old_assigned_to_id:
                try:
                    await release_assignment(db, uuid.UUID(removed_id))
                except Exception as e:
                    logger.warning(f"Failed to release removed secondary assignee {removed_id}: {e}")

        # Increment for added secondary assignees (skip primary, handled above)
        for added_id in new_assignee_ids - old_assignee_ids:
            if added_id != new_assigned_to_id:
                try:
                    stmt = select(TeamMember).where(TeamMember.id == uuid.UUID(added_id))
                    r = await db.execute(stmt)
                    member = r.scalar_one_or_none()
                    if member:
                        member.open_issue_count += 1
                        member.total_assigned_count += 1
                        await db.flush()
                except Exception as e:
                    logger.warning(f"Failed to increment for added secondary assignee {added_id}: {e}")

    # Record close reason in history if provided
    if new_status == "closed" and reason_text:
        await issue_service.add_history(
            db,
            issue_id,
            action="close_reason",
            new_value=reason_text,
            performed_by=user.name,
        )

    updated = await issue_service.get_issue_with_details(db, issue.id)

    # Notify Slack on assignment/assignees change + DM all assignees
    new_assigned_id = str(updated.assigned_to) if updated.assigned_to else ""
    assignment_changed = old_assigned_to_id != new_assigned_id
    assignees_changed = "assignees" in data.model_dump(exclude_unset=True)
    something_assigned = assignment_changed or assignees_changed

    if something_assigned and updated.slack_channel_id and updated.slack_thread_ts:
        try:
            from app.slack_bot.messages import format_assignment_blocks
            assigned_by = f"<@{user.slack_user_id}>" if user.slack_user_id else user.name
            new_assignee = updated.assignee
            fallback, attachments = format_assignment_blocks(
                updated, old_assignee_name, new_assignee, assigned_by, settings.app_base_url
            )
            await slack_service.post_thread_message(
                channel=updated.slack_channel_id,
                thread_ts=updated.slack_thread_ts,
                text="",
                attachments=attachments,
            )
            logger.info(f"Slack assignment notification sent for issue {issue_id}")
        except Exception as e:
            logger.error(f"Failed to notify Slack on assignment change for {issue_id}: {e}", exc_info=True)

    # DM all assignees
    if something_assigned:
        try:
            from app.slack_bot.messages import PRIORITY_COLOR, PRIORITY_EMOJI
            dashboard_url = f"{settings.app_base_url}/issues/{issue_id}"
            channel_display = f"#{updated.slack_channel_name}" if updated.slack_channel_name else (updated.slack_channel_id or "N/A")
            p = updated.priority or "medium"
            team_name_display = updated.team.name if updated.team else "Unknown"
            assigned_by_display = f"<@{user.slack_user_id}>" if user.slack_user_id else user.name

            # Collect all slack_user_ids to DM
            dm_targets = set()
            if updated.assignee and updated.assignee.slack_user_id:
                dm_targets.add(updated.assignee.slack_user_id)
            for a in (updated.assignees or []):
                sid = a.get("slack_user_id")
                if sid:
                    dm_targets.add(sid)

            for slack_uid in dm_targets:
                dm_attachments = [{
                    "color": PRIORITY_COLOR.get(p, "#6B7280"),
                    "blocks": [
                        {"type": "section", "text": {"type": "mrkdwn", "text": ":bust_in_silhouette: *You've been assigned an issue*"}},
                        {"type": "section", "text": {"type": "mrkdwn", "text": f">{updated.title}"}},
                        {"type": "section", "fields": [
                            {"type": "mrkdwn", "text": f"*Priority:* {PRIORITY_EMOJI.get(p, '')} {p.title()}"},
                            {"type": "mrkdwn", "text": f"*Team:* {team_name_display}"},
                            {"type": "mrkdwn", "text": f"*Channel:* {channel_display}"},
                            {"type": "mrkdwn", "text": f"*Assigned by:* {assigned_by_display}"},
                        ]},
                        {"type": "context", "elements": [{"type": "mrkdwn", "text": f"<{dashboard_url}|:mag: View in Dashboard>"}]},
                    ],
                }]
                await slack_service.post_dm(
                    user_id=slack_uid,
                    text=f"You've been assigned: {updated.title}",
                    attachments=dm_attachments,
                )
        except Exception as e:
            logger.error(f"Failed to DM assignee for issue {issue_id}: {e}")

    # DM all leaders of the team on assignment/reassignment
    if something_assigned and updated.team_id:
        try:
            from app.slack_bot.messages import PRIORITY_COLOR, PRIORITY_EMOJI
            stmt = select(TeamMember).where(
                TeamMember.team_id == updated.team_id,
                TeamMember.role == "leader",
                TeamMember.is_active == True,
                TeamMember.slack_user_id != None,
                TeamMember.slack_user_id != "",
            )
            r = await db.execute(stmt)
            leaders = r.scalars().all()

            if leaders:
                dashboard_url = f"{settings.app_base_url}/issues/{issue_id}"
                p = updated.priority or "medium"
                team_name_display = updated.team.name if updated.team else "Unknown"
                assigned_by_display = f"<@{user.slack_user_id}>" if user.slack_user_id else user.name
                new_assignee_names = ", ".join(
                    a.get("name", "?") for a in (updated.assignees or []) if isinstance(a, dict)
                ) or (updated.assignee.name if updated.assignee else "Unassigned")
                old_name = old_assignee_name or "Unassigned"

                for leader in leaders:
                    leader_dm = [{
                        "color": PRIORITY_COLOR.get(p, "#6B7280"),
                        "blocks": [
                            {"type": "section", "text": {"type": "mrkdwn", "text": ":loudspeaker: *Assignment update in your team*"}},
                            {"type": "section", "text": {"type": "mrkdwn", "text": f">{updated.title}"}},
                            {"type": "section", "fields": [
                                {"type": "mrkdwn", "text": f"*Was:* {old_name}"},
                                {"type": "mrkdwn", "text": f"*Now:* {new_assignee_names}"},
                                {"type": "mrkdwn", "text": f"*Priority:* {PRIORITY_EMOJI.get(p, '')} {p.title()}"},
                                {"type": "mrkdwn", "text": f"*By:* {assigned_by_display}"},
                            ]},
                            {"type": "context", "elements": [{"type": "mrkdwn", "text": f"<{dashboard_url}|:mag: View in Dashboard>"}]},
                        ],
                    }]
                    await slack_service.post_dm(
                        user_id=leader.slack_user_id,
                        text=f"Assignment update: {updated.title}",
                        attachments=leader_dm,
                    )
        except Exception as e:
            logger.error(f"Failed to DM leaders for issue {issue_id}: {e}")

    # Notify Slack on status change
    if data.status and data.status != old_status and updated.slack_channel_id and updated.slack_thread_ts:
        try:
            from app.slack_bot.messages import format_status_change_blocks, STATUS_EMOJI
            msg_ts = updated.slack_message_ts or updated.slack_thread_ts

            # Remove ALL status emojis first
            for emoji in STATUS_EMOJI.values():
                await slack_service.remove_reaction(updated.slack_channel_id, msg_ts, emoji)

            # Add only the new status emoji
            new_emoji = STATUS_EMOJI.get(data.status)
            if new_emoji:
                await slack_service.add_reaction(updated.slack_channel_id, msg_ts, new_emoji)

            # Post rich status change message in thread
            changed_by = f"<@{user.slack_user_id}>" if user.slack_user_id else user.name
            fallback, attachments = format_status_change_blocks(updated, old_status, data.status, settings.app_base_url, changed_by=changed_by)
            await slack_service.post_thread_message(
                channel=updated.slack_channel_id,
                thread_ts=updated.slack_thread_ts,
                text="",
                attachments=attachments,
            )
        except Exception as e:
            logger.error(f"Failed to notify Slack on status change for {issue_id}: {e}")

    return _issue_to_response(updated)


@router.post("/{issue_id}/resolve", response_model=IssueResponse)
async def resolve_issue(
    issue_id: uuid.UUID,
    body: ResolveRequest,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Resolve an issue. Requires a reason. Optionally notify in Slack thread."""
    # Get issue to check permissions
    old_issue = await issue_service.get_issue_with_details(db, issue_id)
    if old_issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")

    # Permission check
    if not user.is_admin:
        is_leader_of_issue_team = old_issue.team_id and user.is_leader_of(old_issue.team_id)
        is_assigned_to_user = await _is_issue_assigned_to_user(old_issue, user, db)

        if not is_leader_of_issue_team and not is_assigned_to_user:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to resolve this issue",
            )

    # Find the current user's team_member ID to record as resolved_by
    resolver_member_id = body.resolved_by
    if not resolver_member_id:
        stmt = select(TeamMember).where(TeamMember.email == user.email).limit(1)
        result = await db.execute(stmt)
        resolver_member = result.scalar_one_or_none()
        if resolver_member:
            resolver_member_id = resolver_member.id

    try:
        issue = await issue_service.resolve_issue(
            db, issue_id, resolved_by_id=resolver_member_id, notes=body.reason,
            performed_by=user.name,
        )
    except ValueError:
        raise HTTPException(status_code=404, detail="Issue not found")

    # Release assignment for ALL assignees (primary + secondary)
    from app.services.assignment_service import release_assignment
    released_ids = set()
    if issue.assigned_to:
        await release_assignment(db, issue.assigned_to)
        released_ids.add(str(issue.assigned_to))
    for a in (issue.assignees or []):
        assignee_id = a.get("id")
        if assignee_id and assignee_id not in released_ids:
            try:
                await release_assignment(db, uuid.UUID(assignee_id))
                released_ids.add(assignee_id)
            except (ValueError, Exception) as e:
                logger.warning(f"Failed to release assignment for secondary assignee {assignee_id}: {e}")

    # Notify in Slack thread
    if issue.slack_channel_id and issue.slack_thread_ts:
        try:
            from app.slack_bot.messages import STATUS_EMOJI, format_resolution_blocks
            msg_ts = issue.slack_message_ts or issue.slack_thread_ts

            # Remove ALL status emojis
            for emoji in STATUS_EMOJI.values():
                await slack_service.remove_reaction(issue.slack_channel_id, msg_ts, emoji)

            # Add only resolved emoji
            await slack_service.add_reaction(issue.slack_channel_id, msg_ts, "white_check_mark")

            # The person who clicked Resolve — use @mention if they have a Slack ID
            if user.slack_user_id:
                resolved_by_display = f"<@{user.slack_user_id}>"
            else:
                resolved_by_display = user.name

            # Post rich resolution message
            fallback, attachments = format_resolution_blocks(issue, resolved_by_display, settings.app_base_url, reason=body.reason)
            await slack_service.post_thread_message(
                channel=issue.slack_channel_id,
                thread_ts=issue.slack_thread_ts,
                text="",
                attachments=attachments,
            )
        except Exception as e:
            logger.error(f"Failed to post Slack resolution for issue {issue_id}: {e}")

    resolved = await issue_service.get_issue_with_details(db, issue.id)
    return _issue_to_response(resolved)


@router.get("/{issue_id}/history", response_model=list[IssueHistoryResponse])
async def get_issue_history(
    issue_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Get the history of changes for an issue."""
    # Verify issue exists
    stmt = select(Issue).where(Issue.id == issue_id)
    result = await db.execute(stmt)
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Issue not found")

    stmt = (
        select(IssueHistory)
        .where(IssueHistory.issue_id == issue_id)
        .order_by(IssueHistory.created_at.desc())
    )
    result = await db.execute(stmt)
    history = result.scalars().all()

    return [IssueHistoryResponse.model_validate(h) for h in history]
