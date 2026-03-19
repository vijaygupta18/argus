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

    # Global error handler — catches errors Bolt swallows before our handler's try/except
    @slack_app.error
    async def global_error_handler(error, body, logger=logger):
        logger.error(f"Slack Bolt global error: {error}", exc_info=True)
        logger.error(f"Event body: {body}")

    # Register handlers
    from app.slack_bot.handlers import register_handlers
    register_handlers(slack_app)
else:
    logger.warning("Slack bot token not configured; Slack bot will not start.")


async def start_slack_bot():
    """Start the Slack bot in Socket Mode with automatic reconnection."""
    import asyncio

    if slack_app is None:
        logger.warning("Slack app not initialized, cannot start bot.")
        return

    if not settings.slack_app_token:
        logger.warning("Slack app-level token not configured; Socket Mode cannot start.")
        return

    backoff = 1
    max_backoff = 60

    while True:
        try:
            logger.info("Starting Slack bot in Socket Mode...")
            handler = AsyncSocketModeHandler(slack_app, settings.slack_app_token)
            await handler.start_async()
            # start_async() returned normally — shouldn't happen, but restart just in case
            logger.warning("Slack Socket Mode handler exited unexpectedly, restarting...")
            backoff = 1
        except asyncio.CancelledError:
            logger.info("Slack bot task cancelled, shutting down.")
            raise
        except Exception as e:
            logger.error(f"Slack bot crashed: {e}", exc_info=True)
            logger.info(f"Restarting Slack bot in {backoff}s...")
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, max_backoff)
