import asyncio
import logging
from datetime import datetime, timedelta, timezone

from .market_data.config import (
    ACTIVE_INTRADAY_REFRESH_DELAY,
    INTRADAY_CANDLE_DURATION,
)
from .config import get_finance_refresh_rate_duration
from .market_data import (
    build_daily_history,
    build_intraday_history,
    build_weekly_intraday_history,
    latest_daily_csv_date,
    latest_weekly_intraday_source_date,
    refresh_weekly_intraday_from_1d,
)
from .ml.store import refresh_all_predictions

logger = logging.getLogger(__name__)


def _refreshed_today(refresh_date) -> bool:
    """Avoid repeating expensive daily cache builds on the same calendar day."""
    return refresh_date is not None and refresh_date == datetime.now().date()


def _floor_datetime(value: datetime, step: timedelta) -> datetime:
    """Align an instant to the beginning of its configured refresh slot."""
    epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
    value_utc = value.astimezone(timezone.utc)
    elapsed = int((value_utc - epoch).total_seconds())
    step_seconds = int(step.total_seconds())

    return epoch + timedelta(seconds=(elapsed // step_seconds) * step_seconds)


def seconds_until_next_intraday_refresh(
    now: datetime | None = None,
    refresh_duration: timedelta | None = None,
) -> float:
    """Schedule work shortly after providers should have completed a new candle."""
    now_utc = now.astimezone(timezone.utc) if now else datetime.now(timezone.utc)
    duration = refresh_duration or INTRADAY_CANDLE_DURATION
    slot = _floor_datetime(now_utc, duration)
    next_refresh = slot + ACTIVE_INTRADAY_REFRESH_DELAY

    if next_refresh <= now_utc:
        next_refresh += duration

    return max((next_refresh - now_utc).total_seconds(), 1)


async def refresh_daily_history_if_needed() -> bool:
    """Refresh daily market history and dependent ML predictions once per day."""
    refresh_date = latest_daily_csv_date()

    if _refreshed_today(refresh_date):
        logger.info("Daily history refresh skipped; already refreshed today.")
        return False

    logger.info("Daily history refresh started.")
    await asyncio.to_thread(build_daily_history)
    logger.info("Daily history refresh completed.")
    logger.info("Daily ML prediction refresh started.")
    await asyncio.to_thread(refresh_all_predictions)
    logger.info("Daily ML prediction refresh completed.")
    return True


async def refresh_weekly_intraday_history_if_needed() -> bool:
    """Refresh the provider-backed weekly intraday source once per day."""
    refresh_date = latest_weekly_intraday_source_date()

    if _refreshed_today(refresh_date):
        logger.info("Weekly intraday refresh skipped; already refreshed today.")
        return False

    logger.info("Weekly intraday refresh started.")
    await asyncio.to_thread(build_weekly_intraday_history)
    logger.info("Weekly intraday refresh completed.")
    return True


async def refresh_intraday_history() -> bool:
    """Refresh current intraday candles on every configured scheduler cycle."""
    logger.info("Intraday history refresh started.")
    await asyncio.to_thread(build_intraday_history)
    logger.info("Intraday history refresh completed.")
    return True


async def run_market_data_scheduler() -> None:
    """Continuously refresh caches without blocking FastAPI request handling."""
    while True:
        refresh_duration = await asyncio.to_thread(
            get_finance_refresh_rate_duration
        )
        logger.info(
            "Next intraday refresh cadence: %s seconds.",
            int(refresh_duration.total_seconds()),
        )
        await asyncio.sleep(
            seconds_until_next_intraday_refresh(
                refresh_duration=refresh_duration
            )
        )

        try:
            await refresh_daily_history_if_needed()
            weekly_refreshed = await refresh_weekly_intraday_history_if_needed()
            intraday_refreshed = await refresh_intraday_history()

            if weekly_refreshed or intraday_refreshed:
                await asyncio.to_thread(refresh_weekly_intraday_from_1d)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Market data refresh failed.")
