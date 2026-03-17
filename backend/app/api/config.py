import logging

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.issue_history import AppConfig
from app.auth import require_admin, require_admin_or_leader, UserContext

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("")
async def get_config(
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(require_admin_or_leader),
):
    """Read all configuration from the app_config table. Admin or leader only."""
    stmt = select(AppConfig).order_by(AppConfig.key)
    result = await db.execute(stmt)
    configs = result.scalars().all()

    return {c.key: c.value for c in configs}


@router.patch("")
async def update_config(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(require_admin),
):
    """
    Update configuration keys. Accepts a JSON object of key-value pairs.
    Creates keys that don't exist, updates those that do. Admin only.
    """
    updated_keys = []

    for key, value in data.items():
        stmt = select(AppConfig).where(AppConfig.key == key)
        result = await db.execute(stmt)
        config = result.scalar_one_or_none()

        if config is not None:
            config.value = str(value) if value is not None else None
        else:
            config = AppConfig(key=key, value=str(value) if value is not None else None)
            db.add(config)

        updated_keys.append(key)

    await db.flush()
    logger.info(f"Updated config keys: {updated_keys} by {user.email}")

    # Return the full updated config
    stmt = select(AppConfig).order_by(AppConfig.key)
    result = await db.execute(stmt)
    configs = result.scalars().all()

    return {c.key: c.value for c in configs}
