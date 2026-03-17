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

    # Dispose the connection pool to release all connections to the shared RDS
    from app.database import engine
    await engine.dispose()
    logger.info("Database connection pool disposed.")

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


@app.get("/mock-vishwakarma/api/investigate/stream")
async def mock_vishwakarma_stream_get():
    """Mock endpoint hint."""
    return {"hint": "Use POST"}


@app.post("/mock-vishwakarma/api/investigate/stream")
async def mock_vishwakarma_stream(request: dict):
    """
    Mock Vishwakarma SSE stream for local testing.
    Simulates a ~30s investigation with tool calls.
    """
    import json
    from fastapi.responses import StreamingResponse

    async def event_stream():
        tools = [
            ("check_prometheus_metrics", "CPU spike to 95% on driver-worker-3 detected at 14:32 UTC"),
            ("search_elasticsearch_logs", "Found 2,341 ERROR entries: 'Connection pool exhausted' in ride-service"),
            ("kubectl_get_pods", "3/5 driver-worker pods in CrashLoopBackOff state"),
            ("check_postgres_slow_queries", "avg query time spiked from 12ms to 4,200ms — missing index on driver_locations.updated_at"),
            ("check_redis_memory", "Redis memory at 98% — 847MB used, eviction policy: noeviction"),
            ("fetch_recent_deployments", "deploy/driver-worker v2.4.1 rolled out 2h before incident — changed pool size 50→10"),
        ]

        for tool_name, tool_result in tools:
            yield f"event: tool_call_start\ndata: {json.dumps({'tool_name': tool_name})}\n\n"
            await asyncio.sleep(3)
            yield f"event: tool_call_result\ndata: {json.dumps({'tool_name': tool_name, 'result': tool_result})}\n\n"
            await asyncio.sleep(1)

        analysis = (
            "## Root Cause Analysis\n\n"
            "**Primary Cause**: Connection pool misconfiguration in v2.4.1 deployment\n\n"
            "The deployment of `driver-worker v2.4.1` reduced the PostgreSQL connection pool "
            "from 50 to 10 connections. Under production load this caused pool exhaustion, "
            "leading to cascading failures:\n\n"
            "1. Driver worker pods failed DB health checks\n"
            "2. Kubernetes marked pods unhealthy → CrashLoopBackOff\n"
            "3. Reduced pod count amplified connection pressure\n"
            "4. Redis hit 98% memory from retry storms\n\n"
            "**Timeline**: Issue began ~2h after deployment during peak traffic.\n\n"
            "## Recommended Actions\n\n"
            "1. **Immediate**: Roll back to v2.4.0\n"
            "2. **Short-term**: Restore pool to 50, add PGBOUNCER\n"
            "3. **Long-term**: Add pool utilization alerts at 70%"
        )

        yield f"event: analysis_done\ndata: {json.dumps({'analysis': analysis})}\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


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


# --- Serve frontend static files (production) ---
import os
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

_static_dir = Path(__file__).resolve().parent.parent / "static"
if _static_dir.exists():
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=str(_static_dir / "assets")), name="static-assets")

    # Serve any other static files (favicon, etc.)
    @app.get("/vite.svg")
    async def vite_svg():
        return FileResponse(str(_static_dir / "vite.svg"))

    # SPA fallback — serve index.html for all non-API routes
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't serve index.html for API/mock routes
        if full_path.startswith("api/") or full_path.startswith("mock-"):
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        file_path = _static_dir / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(_static_dir / "index.html"))
