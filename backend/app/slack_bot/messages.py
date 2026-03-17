from typing import Any

STATUS_EMOJI = {
    "open": "eyes",
    "in_progress": "hammer_and_wrench",
    "resolved": "white_check_mark",
    "closed": "lock",
}

STATUS_LABELS = {
    "open": "Open",
    "in_progress": "In Progress",
    "resolved": "Resolved",
    "closed": "Closed",
}

PRIORITY_EMOJI = {
    "critical": ":rotating_light:",
    "high": ":red_circle:",
    "medium": ":large_orange_circle:",
    "low": ":large_green_circle:",
}


def format_issue_created_blocks(issue: Any, assignee: Any, app_base_url: str) -> tuple[str, list[dict]]:
    """Format Block Kit message for a new issue."""
    priority = issue.priority or "medium"
    p_emoji = PRIORITY_EMOJI.get(priority, ":grey_question:")
    # Use name if slack_user_id looks like a dummy (starts with U_)
    if assignee and assignee.slack_user_id and not assignee.slack_user_id.startswith("U_"):
        assignee_text = f"<@{assignee.slack_user_id}>"
    elif assignee:
        assignee_text = f"*{assignee.name}*"
    else:
        assignee_text = "_Unassigned_"
    team_name = issue.team.name if issue.team else "Unknown"
    category = issue.category or "Uncategorized"
    dashboard_url = f"{app_base_url}/issues/{issue.id}"

    # Use attachments with colored sidebar — renders cleanly without "See more"
    color = PRIORITY_COLOR.get(priority, "#6B7280")

    attachments = [
        {
            "color": color,
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f":rotating_light: *New Issue Tracked*",
                    },
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f">{issue.title}",
                    },
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Priority:* {p_emoji} {priority.title()}"},
                        {"type": "mrkdwn", "text": f"*Team:* {team_name}"},
                        {"type": "mrkdwn", "text": f"*Assigned:* {assignee_text}"},
                        {"type": "mrkdwn", "text": f"*Category:* {category}"},
                    ],
                },
                {
                    "type": "context",
                    "elements": [
                        {"type": "mrkdwn", "text": f"<{dashboard_url}|:mag: View in Dashboard>"},
                    ],
                },
            ],
        }
    ]

    fallback = f"New Issue: {issue.title} | Priority: {priority} | Assigned: {assignee.name if assignee else 'Unassigned'}"
    return fallback, attachments


def format_assignment_blocks(issue: Any, old_assignee_name: str | None, new_assignee: Any, assigned_by: str, app_base_url: str) -> tuple[str, list[dict]]:
    """Format Block Kit message for an assignment change."""
    dashboard_url = f"{app_base_url}/issues/{issue.id}"
    if new_assignee and new_assignee.slack_user_id and not new_assignee.slack_user_id.startswith("U_"):
        new_name = f"<@{new_assignee.slack_user_id}>"
    elif new_assignee:
        new_name = f"*{new_assignee.name}*"
    else:
        new_name = "_Unassigned_"
    old_name = old_assignee_name or "Unassigned"

    lines = [
        f":bust_in_silhouette: *Reassigned*",
        f"",
        f"> *{issue.title}*",
        f"",
        f"~{old_name}~  :arrow_right:  *{new_name}*",
        f":pencil2: by *{assigned_by}*",
        f":link: <{dashboard_url}|View in Dashboard>",
    ]

    blocks = [
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": "\n".join(lines)},
        },
    ]

    new_display = new_assignee.name if new_assignee else "Unassigned"
    fallback = f"Reassigned: {old_name} → {new_display} by {assigned_by} | {issue.title}"
    return fallback, blocks


def format_status_change_blocks(issue: Any, old_status: str, new_status: str, app_base_url: str) -> tuple[str, list[dict]]:
    """Format Block Kit message for a status change."""
    old_label = STATUS_LABELS.get(old_status, old_status)
    new_label = STATUS_LABELS.get(new_status, new_status)
    old_emoji = STATUS_EMOJI.get(old_status, "grey_question")
    new_emoji = STATUS_EMOJI.get(new_status, "grey_question")
    dashboard_url = f"{app_base_url}/issues/{issue.id}"

    lines = [
        f":{new_emoji}: *Status Updated*",
        f"",
        f":{old_emoji}: ~{old_label}~  :arrow_right:  :{new_emoji}: *{new_label}*",
        f"",
        f"> *{issue.title}*",
        f":link: <{dashboard_url}|View in Dashboard>",
    ]

    blocks = [
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": "\n".join(lines)},
        },
    ]

    fallback = f"Status: {old_label} → {new_label} | {issue.title}"
    return fallback, blocks


def format_resolution_blocks(issue: Any, resolved_by: str | None, app_base_url: str) -> tuple[str, list[dict]]:
    """Format Block Kit message for issue resolution."""
    dashboard_url = f"{app_base_url}/issues/{issue.id}"
    resolver_text = f" by *{resolved_by}*" if resolved_by else ""

    duration_text = ""
    if issue.resolved_at:
        try:
            from datetime import datetime, timezone
            resolved = issue.resolved_at
            created = issue.created_at
            if isinstance(resolved, str):
                resolved = datetime.fromisoformat(resolved)
            if isinstance(created, str):
                created = datetime.fromisoformat(created)
            if resolved.tzinfo is None:
                resolved = resolved.replace(tzinfo=timezone.utc)
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            hours = (resolved - created).total_seconds() / 3600
            if hours < 1:
                duration_text = f"{int(hours * 60)} min"
            elif hours < 24:
                duration_text = f"{hours:.1f} hrs"
            else:
                duration_text = f"{hours / 24:.1f} days"
        except Exception:
            pass

    lines = [
        f":white_check_mark: *Issue Resolved*{resolver_text}",
        f"",
        f"> *{issue.title}*",
    ]
    if duration_text:
        lines.append(f":stopwatch: *Time to resolution:* {duration_text}")
    lines.append(f":link: <{dashboard_url}|View in Dashboard>")

    blocks = [
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": "\n".join(lines)},
        },
    ]

    fallback = f"Issue Resolved: {issue.title}{resolver_text}"
    return fallback, blocks


def format_reminder_blocks(issue: Any, assignee: Any, app_base_url: str) -> tuple[str, list[dict]]:
    """Format Block Kit reminder message."""
    if assignee and assignee.slack_user_id and not assignee.slack_user_id.startswith("U_"):
        assignee_mention = f"<@{assignee.slack_user_id}>"
    elif assignee:
        assignee_mention = f"*{assignee.name}*"
    else:
        assignee_mention = "Team"
    dashboard_url = f"{app_base_url}/issues/{issue.id}"
    status_label = STATUS_LABELS.get(issue.status, issue.status)
    p_emoji = PRIORITY_EMOJI.get(issue.priority or "medium", ":grey_question:")

    lines = [
        f":bell: *Reminder — Issue Still {status_label}*",
        f"",
        f"> *{issue.title}*",
        f"",
        f"{p_emoji} *Priority:* {(issue.priority or 'medium').title()}",
        f":bust_in_silhouette: *Assigned:* {assignee_mention}",
        f"",
        f"{assignee_mention} — please provide an update on this issue.",
        f":link: <{dashboard_url}|View in Dashboard>",
    ]

    blocks = [
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": "\n".join(lines)},
        },
    ]

    fallback = f"Reminder: {issue.title} is still {status_label}. Assigned to {assignee.name if assignee else 'team'}."
    return fallback, blocks


# Legacy text-only formatters

def format_issue_created(issue: Any, assignee: Any, app_base_url: str) -> str:
    fallback, _ = format_issue_created_blocks(issue, assignee, app_base_url)
    return fallback


def format_status_change(issue: Any, old_status: str, new_status: str, app_base_url: str) -> str:
    fallback, _ = format_status_change_blocks(issue, old_status, new_status, app_base_url)
    return fallback


def format_reminder(issue: Any, assignee: Any, app_base_url: str) -> str:
    fallback, _ = format_reminder_blocks(issue, assignee, app_base_url)
    return fallback


def format_resolution(issue: Any, resolved_by: str | None = None) -> str:
    resolved_text = f" by *{resolved_by}*" if resolved_by else ""
    return f":white_check_mark: *Issue Resolved*{resolved_text}\n*{issue.title}*"
