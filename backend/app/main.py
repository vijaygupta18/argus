import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup and shutdown lifecycle events."""
    # --- Startup ---
    logger.info("Starting Issue Dashboard API...")

    # Start the reminder scheduler
    from app.services.reminder_service import start_scheduler, stop_scheduler
    start_scheduler()

    # Start Slack bot in background if configured
    slack_task = None
    if settings.slack_bot_token and settings.slack_app_token:
        from app.slack_bot.bot import start_slack_bot
        slack_task = asyncio.create_task(start_slack_bot())
        logger.info("Slack bot starting in background...")

    logger.info("Issue Dashboard API is ready.")
    yield

    # --- Shutdown ---
    logger.info("Shutting down Issue Dashboard API...")
    stop_scheduler()

    if slack_task and not slack_task.done():
        slack_task.cancel()
        try:
            await slack_task
        except asyncio.CancelledError:
            pass

    logger.info("Shutdown complete.")


app = FastAPI(
    title="Issue Dashboard",
    description="Production Issue Dashboard API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all API routers
from app.api import issues, teams, members, dashboard, auth

app.include_router(auth.router)
app.include_router(issues.router)
app.include_router(teams.router)
app.include_router(members.router)
app.include_router(members.member_router)
app.include_router(dashboard.router)


@app.get("/api/health")
async def health():
    """Health check endpoint that verifies DB connectivity."""
    from app.database import async_session_maker
    from sqlalchemy import text
    try:
        async with async_session_maker() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Health check DB probe failed: {e}")
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content={"status": "unhealthy", "detail": "Database unreachable"})
