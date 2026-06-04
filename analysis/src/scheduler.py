import asyncio
import logging
from datetime import datetime, timedelta

from .market_data import (
    build_daily_history,
    build_intraday_history,
    build_weekly_intraday_history,
    latest_daily_csv_date,
    latest_intraday_csv_age,
    latest_weekly_intraday_source_date,
    refresh_weekly_intraday_from_1d,
)

logger = logging.getLogger(__name__)

# Daily and weekly yfinance refreshes are heavy, so they run once per calendar
# day. The 1D/5m cache is the frequent feed and completes the 1W/1h cache.
INTRADAY_REFRESH_INTERVAL = timedelta(hours=1)
SCHEDULER_POLL_INTERVAL = timedelta(hours=1)


def _refreshed_today(refresh_date) -> bool:
    return refresh_date is not None and refresh_date == datetime.now().date()


async def refresh_daily_history_if_needed() -> bool:
    refresh_date = latest_daily_csv_date()

    if _refreshed_today(refresh_date):
        logger.info("Daily history refresh skipped; already refreshed today.")
        return False

    logger.info("Daily history refresh started.")
    await asyncio.to_thread(build_daily_history)
    logger.info("Daily history refresh completed.")
    return True


async def refresh_weekly_intraday_history_if_needed() -> bool:
    refresh_date = latest_weekly_intraday_source_date()

    if _refreshed_today(refresh_date):
        logger.info("Weekly intraday refresh skipped; already refreshed today.")
        return False

    logger.info("Weekly intraday refresh started.")
    await asyncio.to_thread(build_weekly_intraday_history)
    logger.info("Weekly intraday refresh completed.")
    return True


async def refresh_intraday_history_if_needed(
    max_age: timedelta = INTRADAY_REFRESH_INTERVAL,
) -> bool:
    age = latest_intraday_csv_age()

    if age is not None and age < max_age:
        logger.info("Intraday history refresh skipped; newest CSV age is %s.", age)
        return False

    logger.info("Intraday history refresh started.")
    await asyncio.to_thread(build_intraday_history)
    logger.info("Intraday history refresh completed.")
    return True


async def run_market_data_scheduler(
    interval: timedelta = SCHEDULER_POLL_INTERVAL,
) -> None:
    while True:
        try:
            await refresh_daily_history_if_needed()
            weekly_refreshed = await refresh_weekly_intraday_history_if_needed()
            intraday_refreshed = await refresh_intraday_history_if_needed()

            # Persist 1D-derived hourly candles into 1W after either source
            # changes, so the chart keeps those points instead of overlaying
            # them transiently.
            if weekly_refreshed or intraday_refreshed:
                await asyncio.to_thread(refresh_weekly_intraday_from_1d)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Market data refresh failed.")

        await asyncio.sleep(interval.total_seconds())
