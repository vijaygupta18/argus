import asyncio
import logging

from slack_sdk.web.async_client import AsyncWebClient
from slack_sdk.errors import SlackApiError

from app.config import settings

logger = logging.getLogger(__name__)

_MAX_RETRIES = 2


class SlackService:
    def __init__(self):
        if settings.slack_bot_token:
            self.client = AsyncWebClient(token=settings.slack_bot_token)
        else:
            self.client = None
            logger.warning("Slack bot token not configured; Slack integration is disabled.")

    def _check_client(self) -> bool:
        """Return True if client is available, False otherwise. Never raises."""
        if self.client is None:
            logger.debug("Slack client not configured, skipping operation.")
            return False
        return True

    @staticmethod
    async def _retry_on_rate_limit(coro_factory, description: str = "Slack API call"):
        """Retry a Slack API call if rate-limited (429). coro_factory is a zero-arg callable returning a coroutine."""
        for attempt in range(_MAX_RETRIES + 1):
            try:
                return await coro_factory()
            except SlackApiError as e:
                if e.response.status_code == 429 and attempt < _MAX_RETRIES:
                    retry_after = int(e.response.headers.get("Retry-After", 1))
                    logger.warning(f"Rate limited on {description}, retrying after {retry_after}s (attempt {attempt + 1})")
                    await asyncio.sleep(retry_after)
                    continue
                raise

    async def post_thread_message(
        self,
        channel: str,
        thread_ts: str,
        text: str,
        blocks: list[dict] | None = None,
        attachments: list[dict] | None = None,
    ) -> dict | None:
        """Post a message in a Slack thread."""
        if not self._check_client():
            return None
        try:
            kwargs: dict = {
                "channel": channel,
                "thread_ts": thread_ts,
                "text": text,
            }
            if blocks:
                kwargs["blocks"] = blocks
            if attachments:
                kwargs["attachments"] = attachments
            response = await self._retry_on_rate_limit(
                lambda: self.client.chat_postMessage(**kwargs),
                description="post_thread_message",
            )
            return response.data
        except SlackApiError as e:
            logger.error(f"Failed to post thread message: {e.response['error']}")
            return None

    async def post_message(
        self,
        channel: str,
        text: str,
        blocks: list[dict] | None = None,
    ) -> dict | None:
        """Post a message to a Slack channel."""
        if not self._check_client():
            return None
        try:
            response = await self.client.chat_postMessage(
                channel=channel,
                text=text,
                blocks=blocks,
            )
            return response.data
        except SlackApiError as e:
            logger.error(f"Failed to post message: {e.response['error']}")
            return None

    async def post_dm(
        self,
        user_id: str,
        text: str,
        blocks: list[dict] | None = None,
        attachments: list[dict] | None = None,
    ) -> dict | None:
        """Send a DM to a user by opening a conversation and posting."""
        if not self._check_client():
            return None
        try:
            conv = await self._retry_on_rate_limit(
                lambda: self.client.conversations_open(users=[user_id]),
                description="conversations_open",
            )
            channel_id = conv.data["channel"]["id"]
            kwargs: dict = {"channel": channel_id, "text": text}
            if blocks:
                kwargs["blocks"] = blocks
            if attachments:
                kwargs["attachments"] = attachments
            response = await self._retry_on_rate_limit(
                lambda: self.client.chat_postMessage(**kwargs),
                description="post_dm",
            )
            return response.data
        except SlackApiError as e:
            logger.error(f"Failed to DM user {user_id}: {e.response['error']}")
            return None

    async def add_reaction(
        self, channel: str, timestamp: str, emoji: str
    ) -> bool:
        """Add an emoji reaction to a message."""
        if not self._check_client():
            return False
        try:
            await self.client.reactions_add(
                channel=channel,
                timestamp=timestamp,
                name=emoji,
            )
            return True
        except SlackApiError as e:
            # "already_reacted" is not a real error
            if e.response.get("error") == "already_reacted":
                return True
            logger.error(f"Failed to add reaction: {e.response['error']}")
            return False

    async def remove_reaction(
        self, channel: str, timestamp: str, emoji: str
    ) -> bool:
        """Remove an emoji reaction from a message."""
        if not self._check_client():
            return False
        try:
            await self.client.reactions_remove(
                channel=channel,
                timestamp=timestamp,
                name=emoji,
            )
            return True
        except SlackApiError as e:
            if e.response.get("error") == "no_reaction":
                return True
            logger.error(f"Failed to remove reaction: {e.response['error']}")
            return False

    async def get_user_info(self, user_id: str) -> dict:
        """Get Slack user info by user ID."""
        if not self._check_client():
            return {"id": user_id, "name": "Unknown", "email": None, "display_name": ""}
        try:
            response = await self.client.users_info(user=user_id)
            user = response.data.get("user", {})
            return {
                "id": user.get("id"),
                "name": user.get("real_name") or user.get("name", "Unknown"),
                "email": user.get("profile", {}).get("email"),
                "display_name": user.get("profile", {}).get("display_name", ""),
            }
        except SlackApiError as e:
            logger.error(f"Failed to get user info for {user_id}: {e.response['error']}")
            return {"id": user_id, "name": "Unknown", "email": None, "display_name": ""}

    async def get_channel_name(self, channel_id: str) -> str:
        """Get channel name from channel ID."""
        if not self._check_client():
            return channel_id
        try:
            response = await self.client.conversations_info(channel=channel_id)
            return response.data.get("channel", {}).get("name", channel_id)
        except SlackApiError:
            return channel_id

    async def lookup_by_email(self, email: str) -> dict | None:
        """Look up a Slack user by email. Returns user info dict or None."""
        if not self._check_client():
            return None
        try:
            response = await self.client.users_lookupByEmail(email=email)
            user = response.data.get("user", {})
            return {
                "id": user.get("id"),
                "name": user.get("real_name") or user.get("name", "Unknown"),
                "email": user.get("profile", {}).get("email"),
                "display_name": user.get("profile", {}).get("display_name", ""),
            }
        except SlackApiError as e:
            if e.response.get("error") == "users_not_found":
                return None
            logger.error(f"Failed to lookup user by email {email}: {e.response['error']}")
            return None

    async def post_resolution(
        self,
        channel: str,
        thread_ts: str,
        title: str,
        resolved_by: str | None = None,
    ) -> dict | None:
        """Post a resolution notification in a thread."""
        if not self._check_client():
            return None
        resolved_text = f"by *{resolved_by}*" if resolved_by else ""
        text = f":white_check_mark: *Issue Resolved* {resolved_text}\n*{title}*"

        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": text,
                },
            },
        ]

        return await self.post_thread_message(
            channel=channel,
            thread_ts=thread_ts,
            text=f"Issue resolved: {title}",
            blocks=blocks,
        )


slack_service = SlackService()
