import logging
import re

from sqlalchemy import select

from app.database import async_session_maker
from app.models.team import Team
from app.models.team_member import TeamMember
from app.services.ai_service import ai_service
from app.services.assignment_service import assign_issue
from app.services.issue_service import create_issue
from app.services.slack_service import slack_service
from app.slack_bot.messages import format_issue_created_blocks
from app.config import settings

logger = logging.getLogger(__name__)


def register_handlers(app):
    """Register all Slack event handlers on the Bolt app."""

    @app.event("app_mention")
    async def handle_mention(event, say, client):
        """Main entry point: someone tagged the bot to report an issue."""
        channel = event["channel"]
        thread_ts = event.get("thread_ts", event["ts"])
        message_ts = event["ts"]
        user_id = event["user"]
        raw_text = event.get("text", "")

        # Remove bot mention prefix (e.g., "<@U12345> some message" -> "some message")
        text = re.sub(r"<@[A-Z0-9]+>\s*", "", raw_text).strip()

        if not text:
            await say(
                text="Please describe the issue you'd like to report.",
                thread_ts=thread_ts,
            )
            return

        # If mentioned inside an existing thread, ask to create a new thread
        if event.get("thread_ts") and event["thread_ts"] != event["ts"]:
            await say(
                text=":warning: Please report new issues in a *new message*, not inside an existing thread. One thread = one issue.",
                thread_ts=event["thread_ts"],
            )
            return

        # 1. Acknowledge with reaction
        try:
            await slack_service.add_reaction(channel, message_ts, "eyes")
        except Exception as e:
            logger.warning(f"Failed to add reaction: {e}")

        # 1b. Fetch reporter info (name + email) and channel name from Slack
        reporter_info = await slack_service.get_user_info(user_id)
        reporter_name = reporter_info.get("name", "Unknown")
        reporter_email = reporter_info.get("email")
        channel_name = await slack_service.get_channel_name(channel)

        try:
            # Phase 1: Read teams (short DB session, released before AI call)
            async with async_session_maker() as db:
                stmt = select(Team).order_by(Team.name)
                result = await db.execute(stmt)
                teams = result.scalars().all()

                if not teams:
                    await say(
                        text="No teams are configured yet. Please add teams in the dashboard first.",
                        thread_ts=thread_ts,
                    )
                    return

                teams_data = [
                    {"name": t.name, "description": t.description, "id": str(t.id)}
                    for t in teams
                ]
                # Capture team info before session closes
                teams_lookup = {t.name.lower(): {"id": t.id, "name": t.name} for t in teams}
                first_team = {"id": teams[0].id, "name": teams[0].name}

            # Phase 2: AI categorize (no DB connection held — can take 30-90+ seconds)
            categorization = await ai_service.categorize_issue(text, teams_data)

            # Find the matching team
            matched_team_name = categorization.get("team_name", "").lower()
            matched_team = teams_lookup.get(matched_team_name, first_team)

            # Phase 3: Write (fresh DB session for assignment + issue creation)
            async with async_session_maker() as db:
                try:
                    # 4. Auto-assign via load balancing
                    assignee = await assign_issue(db, matched_team["id"])

                    # 5. Create issue in DB
                    issue = await create_issue(
                        db,
                        title=categorization.get("title", text[:100]),
                        description=text,
                        status="open",
                        priority=categorization.get("priority", "medium"),
                        category=categorization.get("category"),
                        team_id=matched_team["id"],
                        assigned_to=assignee.id if assignee else None,
                        reported_by_slack_id=user_id,
                        reported_by_name=reporter_name,
                        reported_by_email=reporter_email,
                        slack_channel_id=channel,
                        slack_channel_name=channel_name,
                        slack_thread_ts=thread_ts,
                        slack_message_ts=message_ts,
                        ai_categorization=categorization,
                        ai_provider_used=settings.ai_provider,
                    )

                    await db.commit()

                    # 6. Reply in thread with rich attachment message
                    fallback, attachments = format_issue_created_blocks(
                        issue, assignee, settings.app_base_url
                    )

                    await say(text="", attachments=attachments, thread_ts=thread_ts)

                    # 7. DM the assigned person
                    if assignee and assignee.slack_user_id:
                        try:
                            from app.slack_bot.messages import PRIORITY_COLOR, PRIORITY_EMOJI
                            dashboard_url = f"{settings.app_base_url}/issues/{issue.id}"
                            p = issue.priority or "medium"
                            dm_attachments = [{
                                "color": PRIORITY_COLOR.get(p, "#6B7280"),
                                "blocks": [
                                    {"type": "section", "text": {"type": "mrkdwn", "text": ":bust_in_silhouette: *You've been assigned a new issue*"}},
                                    {"type": "section", "text": {"type": "mrkdwn", "text": f">{issue.title}"}},
                                    {"type": "section", "fields": [
                                        {"type": "mrkdwn", "text": f"*Priority:* {PRIORITY_EMOJI.get(p, '')} {p.title()}"},
                                        {"type": "mrkdwn", "text": f"*Team:* {matched_team['name']}"},
                                        {"type": "mrkdwn", "text": f"*Channel:* #{channel_name}"},
                                        {"type": "mrkdwn", "text": f"*Reported by:* <@{user_id}>"},
                                    ]},
                                    {"type": "context", "elements": [{"type": "mrkdwn", "text": f"<{dashboard_url}|:mag: View in Dashboard>"}]},
                                ],
                            }]
                            await slack_service.post_dm(
                                user_id=assignee.slack_user_id,
                                text=f"You've been assigned: {issue.title}",
                                attachments=dm_attachments,
                            )
                        except Exception as e:
                            logger.warning(f"Failed to DM assignee: {e}")

                    # 8. DM all leaders of the team
                    try:
                        from app.slack_bot.messages import PRIORITY_COLOR, PRIORITY_EMOJI
                        stmt = select(TeamMember).where(
                            TeamMember.team_id == matched_team["id"],
                            TeamMember.role == "leader",
                            TeamMember.is_active == True,
                            TeamMember.slack_user_id != None,
                            TeamMember.slack_user_id != "",
                        )
                        r = await db.execute(stmt)
                        leaders = r.scalars().all()

                        if leaders:
                            dashboard_url = f"{settings.app_base_url}/issues/{issue.id}"
                            p = issue.priority or "medium"
                            assignee_name = assignee.name if assignee else "Unassigned"
                            for leader in leaders:
                                leader_dm = [{
                                    "color": PRIORITY_COLOR.get(p, "#6B7280"),
                                    "blocks": [
                                        {"type": "section", "text": {"type": "mrkdwn", "text": ":loudspeaker: *New issue assigned in your team*"}},
                                        {"type": "section", "text": {"type": "mrkdwn", "text": f">{issue.title}"}},
                                        {"type": "section", "fields": [
                                            {"type": "mrkdwn", "text": f"*Assigned to:* {assignee_name}"},
                                            {"type": "mrkdwn", "text": f"*Priority:* {PRIORITY_EMOJI.get(p, '')} {p.title()}"},
                                            {"type": "mrkdwn", "text": f"*Channel:* #{channel_name}"},
                                            {"type": "mrkdwn", "text": f"*Reported by:* <@{user_id}>"},
                                        ]},
                                        {"type": "context", "elements": [{"type": "mrkdwn", "text": f"<{dashboard_url}|:mag: View in Dashboard>"}]},
                                    ],
                                }]
                                await slack_service.post_dm(
                                    user_id=leader.slack_user_id,
                                    text=f"New issue in your team: {issue.title}",
                                    attachments=leader_dm,
                                )
                    except Exception as e:
                        logger.warning(f"Failed to DM leaders: {e}")

                    logger.info(
                        f"Created issue from Slack: {issue.id} - {issue.title} "
                        f"(team={matched_team['name']}, assignee={assignee.name if assignee else 'none'})"
                    )

                except Exception as e:
                    logger.error(f"Error handling app_mention (DB phase): {e}", exc_info=True)
                    await db.rollback()
                    await say(
                        text=f"Sorry, I encountered an error while processing your issue: {str(e)}",
                        thread_ts=thread_ts,
                    )

        except Exception as e:
            logger.error(f"Error handling app_mention: {e}", exc_info=True)
            await say(
                text=f"Sorry, I encountered an error while processing your issue: {str(e)}",
                thread_ts=thread_ts,
            )

    @app.event("message")
    async def handle_message(event, say):
        """Handle general messages (needed to prevent warning logs from Bolt)."""
        # We only act on app_mention events, but Bolt requires a handler
        # for message events to avoid unhandled event warnings.
        pass
