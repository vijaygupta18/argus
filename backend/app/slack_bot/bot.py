import logging

from slack_bolt.async_app import AsyncApp
from slack_bolt.adapter.socket_mode.async_handler import AsyncSocketModeHandler

from app.config import settings

logger = logging.getLogger(__name__)

# Initialize the Bolt async app
# Only create the app if we have a bot token; otherwise leave as None
slack_app: AsyncApp | None = None

if settings.slack_bot_token:
    slack_app = AsyncApp(
        token=settings.slack_bot_token,
        signing_secret=settings.slack_signing_secret if settings.slack_signing_secret else None,
    )

    # Register handlers
    from app.slack_bot.handlers import register_handlers
    register_handlers(slack_app)
else:
    logger.warning("Slack bot token not configured; Slack bot will not start.")


async def start_slack_bot():
    """Start the Slack bot in Socket Mode."""
    if slack_app is None:
        logger.warning("Slack app not initialized, cannot start bot.")
        return

    if not settings.slack_app_token:
        logger.warning("Slack app-level token not configured; Socket Mode cannot start.")
        return

    logger.info("Starting Slack bot in Socket Mode...")
    handler = AsyncSocketModeHandler(slack_app, settings.slack_app_token)
    await handler.start_async()
