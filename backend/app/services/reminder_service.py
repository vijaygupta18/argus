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
    if slack_service.client is None:
        logger.debug("Slack client not configured, skipping reminder check")
        return

    async with async_session_maker() as db:
        try:
            now = datetime.now(timezone.utc)

            # Query issues that are open or in progress, with team info
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

            reminders_sent = 0

            for issue in issues:
                team = issue.team
                if team is None:
                    continue

                frequency_minutes = team.reminder_frequency_minutes

                # Determine time reference: last reminder or creation time
                reference_time = issue.last_reminder_sent_at or issue.created_at

                # Parse reference_time if it's a string
                if isinstance(reference_time, str):
                    try:
                        reference_time = datetime.fromisoformat(reference_time)
                    except (ValueError, TypeError):
                        continue

                # Make sure reference_time is timezone-aware
                if reference_time.tzinfo is None:
                    reference_time = reference_time.replace(tzinfo=timezone.utc)

                elapsed_minutes = (now - reference_time).total_seconds() / 60

                if elapsed_minutes < frequency_minutes:
                    continue

                # Check if current hour is within reminder hours (respect reminder_start_hour)
                current_hour = now.hour
                if current_hour < team.reminder_start_hour:
                    continue

                # Build and send reminder with Block Kit
                assignee = issue.assignee
                fallback, attachments = format_reminder_blocks(issue, assignee, settings.app_base_url)

                sent = await slack_service.post_thread_message(
                    channel=issue.slack_channel_id,
                    thread_ts=issue.slack_thread_ts,
                    text="",
                    attachments=attachments,
                )

                if sent:
                    issue.last_reminder_sent_at = now

                    history = IssueHistory(
                        issue_id=issue.id,
                        action="reminder_sent",
                        new_value=f"Reminder sent at {now.isoformat()}",
                        performed_by="scheduler",
                    )
                    db.add(history)

                    reminders_sent += 1
                    logger.info(f"Sent reminder for issue {issue.id}: {issue.title}")

            if reminders_sent > 0:
                await db.commit()
                logger.info(f"Sent {reminders_sent} reminders")

        except Exception as e:
            logger.error(f"Error in reminder check: {e}", exc_info=True)
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
