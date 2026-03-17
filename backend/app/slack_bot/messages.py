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

PRIORITY_COLOR = {
    "critical": "#DC2626",
    "high": "#EA580C",
    "medium": "#F59E0B",
    "low": "#10B981",
}

STATUS_COLOR = {
    "open": "#3B82F6",
    "in_progress": "#F59E0B",
    "resolved": "#10B981",
    "closed": "#6B7280",
}


def _mention(member: Any) -> str:
    """Convert a team member to a Slack @mention. Always use <@ID> for real Slack users."""
    if member and getattr(member, "slack_user_id", None):
        return f"<@{member.slack_user_id}>"
    if member and getattr(member, "name", None):
        return member.name
    return "_Unassigned_"


def _mention_name(name: str | None, slack_user_id: str | None) -> str:
    """Create a Slack mention from name + slack_user_id."""
    if slack_user_id:
        return f"<@{slack_user_id}>"
    return name or "Unknown"


def format_issue_created_blocks(issue: Any, assignee: Any, app_base_url: str) -> tuple[str, list[dict]]:
    priority = issue.priority or "medium"
    p_emoji = PRIORITY_EMOJI.get(priority, ":grey_question:")
    assignee_text = _mention(assignee)
    team_name = issue.team.name if issue.team else "Unknown"
    category = issue.category or "Uncategorized"
    dashboard_url = f"{app_base_url}/issues/{issue.id}"
    color = PRIORITY_COLOR.get(priority, "#6B7280")

    attachments = [{
        "color": color,
        "blocks": [
            {"type": "section", "text": {"type": "mrkdwn", "text": ":rotating_light: *New Issue Tracked*"}},
            {"type": "section", "text": {"type": "mrkdwn", "text": f">{issue.title}"}},
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f"*Priority:* {p_emoji} {priority.title()}"},
                {"type": "mrkdwn", "text": f"*Team:* {team_name}"},
                {"type": "mrkdwn", "text": f"*Assigned:* {assignee_text}"},
                {"type": "mrkdwn", "text": f"*Category:* {category}"},
            ]},
            {"type": "context", "elements": [{"type": "mrkdwn", "text": f"<{dashboard_url}|:mag: View in Dashboard>"}]},
        ],
    }]

    fallback = f"New Issue: {issue.title}"
    return fallback, attachments


def _assignees_text(issue: Any) -> str:
    """Build a mention list from issue.assignees JSONB or primary assignee."""
    assignees = getattr(issue, "assignees", None) or []
    if assignees:
        names = []
        for a in assignees:
            sid = a.get("slack_user_id") if isinstance(a, dict) else None
            name = a.get("name", "?") if isinstance(a, dict) else "?"
            names.append(f"<@{sid}>" if sid else name)
        return ", ".join(names)
    assignee = getattr(issue, "assignee", None)
    if assignee:
        return _mention(assignee)
    return "_Unassigned_"


def format_assignment_blocks(issue: Any, old_assignee_name: str | None, new_assignee: Any, assigned_by: str, app_base_url: str) -> tuple[str, list[dict]]:
    dashboard_url = f"{app_base_url}/issues/{issue.id}"
    new_names = _assignees_text(issue)
    old_name = old_assignee_name or "Unassigned"

    attachments = [{
        "color": "#3B82F6",
        "blocks": [
            {"type": "section", "text": {"type": "mrkdwn", "text": ":bust_in_silhouette: *Reassigned*"}},
            {"type": "section", "text": {"type": "mrkdwn", "text": f">{issue.title}"}},
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f"*From:* ~{old_name}~"},
                {"type": "mrkdwn", "text": f"*To:* {new_names}"},
                {"type": "mrkdwn", "text": f"*By:* {assigned_by}"},
            ]},
            {"type": "context", "elements": [{"type": "mrkdwn", "text": f"<{dashboard_url}|:mag: View in Dashboard>"}]},
        ],
    }]

    fallback = f"Reassigned: {issue.title}"
    return fallback, attachments


def format_status_change_blocks(issue: Any, old_status: str, new_status: str, app_base_url: str, changed_by: str | None = None) -> tuple[str, list[dict]]:
    old_label = STATUS_LABELS.get(old_status, old_status)
    new_label = STATUS_LABELS.get(new_status, new_status)
    new_emoji = STATUS_EMOJI.get(new_status, "grey_question")
    color = STATUS_COLOR.get(new_status, "#6B7280")
    dashboard_url = f"{app_base_url}/issues/{issue.id}"
    by_text = f"  ·  by {changed_by}" if changed_by else ""

    attachments = [{
        "color": color,
        "blocks": [
            {"type": "section", "text": {"type": "mrkdwn", "text": f":{new_emoji}: *Status Updated*  ·  ~{old_label}~ → *{new_label}*{by_text}"}},
            {"type": "section", "text": {"type": "mrkdwn", "text": f">{issue.title}"}},
            {"type": "context", "elements": [{"type": "mrkdwn", "text": f"<{dashboard_url}|:mag: View in Dashboard>"}]},
        ],
    }]

    fallback = f"Status: {old_label} → {new_label} | {issue.title}"
    return fallback, attachments


def format_resolution_blocks(issue: Any, resolved_by: str | None, app_base_url: str) -> tuple[str, list[dict]]:
    dashboard_url = f"{app_base_url}/issues/{issue.id}"

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

    attachments = [{
        "color": "#10B981",
        "blocks": [
            {"type": "section", "text": {"type": "mrkdwn", "text": ":white_check_mark: *Issue Resolved*"}},
            {"type": "section", "text": {"type": "mrkdwn", "text": f">{issue.title}"}},
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f"*Resolved by:* {resolved_by or 'Unknown'}"},
                {"type": "mrkdwn", "text": f"*Time to resolution:* {duration_text or 'N/A'}"},
            ]},
            {"type": "context", "elements": [{"type": "mrkdwn", "text": f"<{dashboard_url}|:mag: View in Dashboard>"}]},
        ],
    }]

    fallback = f"Issue Resolved: {issue.title}"
    return fallback, attachments


def format_reminder_blocks(issue: Any, assignee: Any, app_base_url: str) -> tuple[str, list[dict]]:
    assignee_mention = _mention(assignee)
    dashboard_url = f"{app_base_url}/issues/{issue.id}"
    status_label = STATUS_LABELS.get(issue.status, issue.status)
    p_emoji = PRIORITY_EMOJI.get(issue.priority or "medium", ":grey_question:")

    attachments = [{
        "color": "#F59E0B",
        "blocks": [
            {"type": "section", "text": {"type": "mrkdwn", "text": f":bell: *Reminder — Issue Still {status_label}*"}},
            {"type": "section", "text": {"type": "mrkdwn", "text": f">{issue.title}"}},
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f"*Priority:* {p_emoji} {(issue.priority or 'medium').title()}"},
                {"type": "mrkdwn", "text": f"*Assigned:* {assignee_mention}"},
            ]},
            {"type": "section", "text": {"type": "mrkdwn", "text": f"{assignee_mention} — please provide an update."}},
            {"type": "context", "elements": [{"type": "mrkdwn", "text": f"<{dashboard_url}|:mag: View in Dashboard>"}]},
        ],
    }]

    fallback = f"Reminder: {issue.title}"
    return fallback, attachments
