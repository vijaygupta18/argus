import json
import logging
import re
import uuid
from datetime import datetime, timezone

from sqlalchemy import text

from app.database import engine
from app.services.ai_service import ai_service
from app.services.slack_service import slack_service
from app.slack_bot.messages import format_issue_created_blocks
from app.config import settings

logger = logging.getLogger(__name__)

# Schema prefix for raw SQL
_s = f"{settings.db_schema}." if settings.db_schema else ""


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
        # FIX 4: Only strip the FIRST @mention so other user mentions in the body are preserved
        issue_text = re.sub(r"<@[A-Z0-9]+>\s*", "", raw_text, count=1).strip()

        if not issue_text:
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
            # ── Phase 1: Read teams (raw SQL, no ORM/greenlet needed) ──
            async with engine.connect() as conn:
                result = await conn.execute(
                    text(f"SELECT id, name, description FROM {_s}teams ORDER BY name")
                )
                teams_rows = result.fetchall()

            if not teams_rows:
                await say(
                    text="No teams are configured yet. Please add teams in the dashboard first.",
                    thread_ts=thread_ts,
                )
                return

            teams_data = [
                {"name": r.name, "description": r.description or "", "id": str(r.id)}
                for r in teams_rows
            ]
            teams_lookup = {r.name.lower(): {"id": r.id, "name": r.name} for r in teams_rows}
            first_team = {"id": teams_rows[0].id, "name": teams_rows[0].name}

            # ── Phase 2: AI categorize (no DB connection held) ──
            categorization = await ai_service.categorize_issue(issue_text, teams_data)

            matched_team_name = categorization.get("team_name", "").lower()
            matched_team = teams_lookup.get(matched_team_name, first_team)
            team_id = matched_team["id"]

            # ── Phase 3: Write issue + assign (raw SQL, single transaction) ──
            issue_id = uuid.uuid4()
            now = datetime.now(timezone.utc)
            priority = categorization.get("priority", "medium")
            category = categorization.get("category")
            title = categorization.get("title", issue_text[:100])

            assignee_row = None
            async with engine.begin() as conn:
                # FIX 2: Auto-assign with FOR UPDATE SKIP LOCKED to prevent
                # concurrent issues from all picking the same person
                result = await conn.execute(
                    text(f"""
                        SELECT id, name, slack_user_id, email, open_issue_count
                        FROM {_s}team_members
                        WHERE team_id = :team_id AND is_active = true AND role = 'worker'
                        ORDER BY open_issue_count ASC, total_assigned_count ASC
                        LIMIT 1
                        FOR UPDATE SKIP LOCKED
                    """),
                    {"team_id": team_id},
                )
                assignee_row = result.fetchone()

                assigned_to = assignee_row.id if assignee_row else None

                if assignee_row:
                    await conn.execute(
                        text(f"""
                            UPDATE {_s}team_members
                            SET open_issue_count = open_issue_count + 1,
                                total_assigned_count = total_assigned_count + 1,
                                updated_at = :now
                            WHERE id = :member_id
                        """),
                        {"member_id": assigned_to, "now": now},
                    )

                # FIX 1: Build assignees JSONB value
                if assignee_row:
                    assignees_json = json.dumps([{
                        "id": str(assigned_to),
                        "name": assignee_row.name,
                        "slack_user_id": assignee_row.slack_user_id,
                    }])
                else:
                    assignees_json = "[]"

                # Insert issue
                # FIX 1: Added assignees column with ::jsonb cast
                await conn.execute(
                    text(f"""
                        INSERT INTO {_s}issues (
                            id, title, description, status, priority, category,
                            team_id, assigned_to, assignees,
                            reported_by_slack_id, reported_by_name,
                            reported_by_email, slack_channel_id, slack_channel_name,
                            slack_thread_ts, slack_message_ts,
                            ai_categorization, ai_provider_used, created_at, updated_at
                        ) VALUES (
                            :id, :title, :description, 'open', :priority, :category,
                            :team_id, :assigned_to, CAST(:assignees AS jsonb),
                            :reported_by_slack_id, :reported_by_name,
                            :reported_by_email, :slack_channel_id, :slack_channel_name,
                            :slack_thread_ts, :slack_message_ts,
                            CAST(:ai_categorization AS jsonb), :ai_provider_used, :now, :now
                        )
                    """),
                    {
                        "id": issue_id,
                        "title": title,
                        "description": issue_text,
                        "priority": priority,
                        "category": category,
                        "team_id": team_id,
                        "assigned_to": assigned_to,
                        "assignees": assignees_json,
                        "reported_by_slack_id": user_id,
                        "reported_by_name": reporter_name,
                        "reported_by_email": reporter_email,
                        "slack_channel_id": channel,
                        "slack_channel_name": channel_name,
                        "slack_thread_ts": thread_ts,
                        "slack_message_ts": message_ts,
                        "ai_categorization": json.dumps(categorization),
                        "ai_provider_used": settings.ai_provider,
                        "now": now,
                    },
                )

                # Insert history: created
                await conn.execute(
                    text(f"""
                        INSERT INTO {_s}issue_history (id, issue_id, action, new_value, performed_by, created_at)
                        VALUES (:id, :issue_id, 'created', :title, :performer, :now)
                    """),
                    {"id": uuid.uuid4(), "issue_id": issue_id, "title": title, "performer": reporter_name, "now": now},
                )

                # Insert history: assigned
                if assignee_row:
                    await conn.execute(
                        text(f"""
                            INSERT INTO {_s}issue_history (id, issue_id, action, new_value, performed_by, created_at)
                            VALUES (:id, :issue_id, 'assigned', :assignee_name, :performer, :now)
                        """),
                        {"id": uuid.uuid4(), "issue_id": issue_id, "assignee_name": assignee_row.name, "performer": reporter_name, "now": now},
                    )

                # Fetch leaders for DM
                leaders_result = await conn.execute(
                    text(f"""
                        SELECT name, slack_user_id FROM {_s}team_members
                        WHERE team_id = :team_id AND role = 'leader' AND is_active = true
                        AND slack_user_id IS NOT NULL AND slack_user_id != ''
                    """),
                    {"team_id": team_id},
                )
                leaders = leaders_result.fetchall()

            # ── Phase 4: Slack notifications (no DB needed) ──

            # Build lightweight objects for format_issue_created_blocks
            # (messages.py accesses issue.team.name, issue.priority, issue.category, etc.)
            class _Obj:
                pass

            team_obj = _Obj()
            team_obj.name = matched_team["name"]

            issue_obj = _Obj()
            issue_obj.id = issue_id
            issue_obj.title = title
            issue_obj.priority = priority
            issue_obj.category = category
            issue_obj.status = "open"
            issue_obj.created_at = now
            issue_obj.team = team_obj

            assignee_obj = None
            if assignee_row:
                assignee_obj = _Obj()
                assignee_obj.id = assignee_row.id
                assignee_obj.name = assignee_row.name
                assignee_obj.slack_user_id = assignee_row.slack_user_id

            fallback, attachments = format_issue_created_blocks(
                issue_obj, assignee_obj, settings.app_base_url
            )
            # FIX 3: Use fallback text so mobile push notifications aren't blank
            await say(text=fallback, attachments=attachments, thread_ts=thread_ts)

            # DM the assigned person
            if assignee_obj and assignee_obj.slack_user_id:
                try:
                    from app.slack_bot.messages import PRIORITY_COLOR, PRIORITY_EMOJI
                    dashboard_url = f"{settings.app_base_url}/issues/{issue_id}"
                    p = priority or "medium"
                    dm_attachments = [{
                        "color": PRIORITY_COLOR.get(p, "#6B7280"),
                        "blocks": [
                            {"type": "section", "text": {"type": "mrkdwn", "text": ":bust_in_silhouette: *You've been assigned a new issue*"}},
                            {"type": "section", "text": {"type": "mrkdwn", "text": f">{title}"}},
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
                        user_id=assignee_obj.slack_user_id,
                        text=f"You've been assigned: {title}",
                        attachments=dm_attachments,
                    )
                except Exception as e:
                    logger.warning(f"Failed to DM assignee: {e}")

            # DM all leaders of the team
            if leaders:
                try:
                    from app.slack_bot.messages import PRIORITY_COLOR, PRIORITY_EMOJI
                    dashboard_url = f"{settings.app_base_url}/issues/{issue_id}"
                    p = priority or "medium"
                    assignee_name = assignee_row.name if assignee_row else "Unassigned"
                    # FIX 7: Use different header when no worker was found
                    if assignee_row:
                        leader_header = ":loudspeaker: *New issue assigned in your team*"
                    else:
                        leader_header = ":loudspeaker: *New issue in your team (unassigned)*"
                    for leader in leaders:
                        leader_dm = [{
                            "color": PRIORITY_COLOR.get(p, "#6B7280"),
                            "blocks": [
                                {"type": "section", "text": {"type": "mrkdwn", "text": leader_header}},
                                {"type": "section", "text": {"type": "mrkdwn", "text": f">{title}"}},
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
                            text=f"New issue in your team: {title}",
                            attachments=leader_dm,
                        )
                except Exception as e:
                    logger.warning(f"Failed to DM leaders: {e}")

            logger.info(
                f"Created issue from Slack: {issue_id} - {title} "
                f"(team={matched_team['name']}, assignee={assignee_row.name if assignee_row else 'none'})"
            )

        except Exception as e:
            # FIX 5: Log the full error but don't leak internal details to Slack
            logger.error(f"Error handling app_mention: {e}", exc_info=True)
            # FIX 6: Wrap the error handler's say() in try/except so a Slack
            # failure here doesn't raise an unhandled exception
            try:
                await say(
                    text="Sorry, something went wrong while processing your issue. Please try again or contact support.",
                    thread_ts=thread_ts,
                )
            except Exception as notify_err:
                logger.error(f"Failed to notify user of error via Slack: {notify_err}", exc_info=True)

    @app.event("message")
    async def handle_message(event, say):
        """Handle general messages (needed to prevent warning logs from Bolt)."""
        pass
