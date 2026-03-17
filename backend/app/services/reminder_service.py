import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import and_, select
from sqlalchemy.orm import joinedload

from app.database import async_session_maker
from app.models.issue import Issue
from app.models.team import Team
from app.models.issue_history import IssueHistory
from app.services.slack_service import slack_service
from app.slack_bot.messages import format_reminder_blocks
from app.config import settings

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

_reminder_lock = False


async def check_and_send_reminders():
    """
    Check for issues needing reminders and send Slack messages.

    An issue needs a reminder when:
    - status is open or in_progress
    - team.notifications_enabled is true
    - issue.notifications_muted is false
    - Either:
      - last_reminder_sent_at is NULL and time since created_at > team.reminder_frequency_minutes
      - last_reminder_sent_at is not NULL and time since last_reminder_sent_at > team.reminder_frequency_minutes
    """
    global _reminder_lock
    if _reminder_lock:
        logger.debug("Reminder check already in progress, skipping")
        return

    if slack_service.client is None:
        logger.debug("Slack client not configured, skipping reminder check")
        return

    _reminder_lock = True
    try:
        await _do_reminder_check()
    finally:
        _reminder_lock = False


async def _do_reminder_check():
    """Inner function that performs the actual reminder check."""
    now = datetime.now(timezone.utc)

    # Phase 1: Quick read — get issues needing reminders, release connection immediately
    issues_to_remind = []
    async with async_session_maker() as db:
        try:
            stmt = (
                select(Issue)
                .join(Team, Issue.team_id == Team.id)
                .options(
                    joinedload(Issue.team),
                    joinedload(Issue.assignee),
                )
                .where(
                    and_(
                        Issue.status.in_(["open", "in_progress"]),
                        Team.notifications_enabled.is_(True),
                        Issue.notifications_muted.is_(False),
                        Issue.slack_channel_id.isnot(None),
                        Issue.slack_thread_ts.isnot(None),
                    )
                )
            )

            result = await db.execute(stmt)
            issues = result.unique().scalars().all()

            for issue in issues:
                team = issue.team
                if team is None:
                    continue

                frequency_minutes = team.reminder_frequency_minutes
                reference_time = issue.last_reminder_sent_at or issue.created_at

                if isinstance(reference_time, str):
                    try:
                        reference_time = datetime.fromisoformat(reference_time)
                    except (ValueError, TypeError):
                        continue

                if reference_time.tzinfo is None:
                    reference_time = reference_time.replace(tzinfo=timezone.utc)

                elapsed_minutes = (now - reference_time).total_seconds() / 60
                if elapsed_minutes < frequency_minutes:
                    continue

                current_hour = now.hour
                if current_hour < team.reminder_start_hour:
                    continue

                issues_to_remind.append({
                    "id": issue.id,
                    "title": issue.title,
                    "channel": issue.slack_channel_id,
                    "thread_ts": issue.slack_thread_ts,
                    "issue": issue,
                    "assignee": issue.assignee,
                })

        except Exception as e:
            logger.error(f"Error reading issues for reminders: {e}", exc_info=True)
            return

    # Phase 2: Send Slack messages OUTSIDE any DB transaction
    sent_issue_ids = []
    for item in issues_to_remind:
        try:
            fallback, attachments = format_reminder_blocks(item["issue"], item["assignee"], settings.app_base_url)
            sent = await slack_service.post_thread_message(
                channel=item["channel"],
                thread_ts=item["thread_ts"],
                text="",
                attachments=attachments,
            )
            if sent:
                sent_issue_ids.append(item["id"])
                logger.info(f"Sent reminder for issue {item['id']}: {item['title']}")
        except Exception as e:
            logger.error(f"Failed to send reminder for {item['id']}: {e}")

    # Phase 3: Quick write — update timestamps, release connection immediately
    if sent_issue_ids:
        async with async_session_maker() as db:
            try:
                for issue_id in sent_issue_ids:
                    stmt = select(Issue).where(Issue.id == issue_id)
                    result = await db.execute(stmt)
                    issue = result.scalar_one_or_none()
                    if issue:
                        issue.last_reminder_sent_at = now
                        db.add(IssueHistory(
                            issue_id=issue_id,
                            action="reminder_sent",
                            new_value=f"Reminder sent at {now.isoformat()}",
                            performed_by="scheduler",
                        ))
                await db.commit()
                logger.info(f"Sent {len(sent_issue_ids)} reminders")
            except Exception as e:
                logger.error(f"Error saving reminder state: {e}", exc_info=True)
                await db.rollback()


def start_scheduler():
    """Start the APScheduler for periodic reminder checks."""
    scheduler.add_job(
        check_and_send_reminders,
        "interval",
        minutes=5,
        id="reminder_check",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Reminder scheduler started (interval: 5 minutes)")


def stop_scheduler():
    """Shut down the scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Reminder scheduler stopped")
