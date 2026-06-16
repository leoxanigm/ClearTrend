from datetime import date, datetime

from .market_data import (
    build_daily_history,
    build_intraday_history,
    build_weekly_intraday_history,
    latest_daily_csv_date,
    latest_intraday_csv_age,
    latest_weekly_intraday_source_date,
    refresh_weekly_intraday_from_1d,
)
from .market_data.config import (
    DAILY_BATCH_PAUSE_SECONDS,
    DAILY_BATCH_SIZE,
    DATA_DIR,
    LONG_HISTORY_PERIOD,
    LONG_HISTORY_TICKERS,
    intraday_interval_for_refresh_seconds,
    sanitize_ticker,
)
from .config import get_finance_refresh_rate_duration
from .market_data.fetcher import process_tickers
from .market_data.storage import latest_file
from .ml.store import refresh_all_predictions


def _refreshed_today(refresh_date: date | None) -> bool:
    return refresh_date is not None and refresh_date == datetime.now().date()


def _build_missing_long_history() -> None:
    missing = [
        ticker
        for ticker in LONG_HISTORY_TICKERS
        if latest_file(DATA_DIR, sanitize_ticker(ticker)) is None
    ]

    if not missing:
        return

    process_tickers(
        missing,
        batch_size=DAILY_BATCH_SIZE,
        interval="1d",
        pause_seconds=DAILY_BATCH_PAUSE_SECONDS,
        period=LONG_HISTORY_PERIOD,
        target_dir=DATA_DIR,
    )


def build_missing_or_stale_history() -> None:
    weekly_refreshed = False
    intraday_refreshed = False

    # Warm daily history before the API starts when the cache is missing/stale.
    if not _refreshed_today(latest_daily_csv_date()):
        build_daily_history()
    else:
        _build_missing_long_history()

    # 1W hourly cache is rebuilt from yfinance once per day, then completed
    # from the configured 1D intraday cache below.
    if not _refreshed_today(latest_weekly_intraday_source_date()):
        build_weekly_intraday_history()
        weekly_refreshed = True

    refresh_duration = get_finance_refresh_rate_duration()
    intraday_interval = intraday_interval_for_refresh_seconds(
        int(refresh_duration.total_seconds())
    )
    intraday_age = latest_intraday_csv_age(intraday_interval)

    # Warm intraday cache too, otherwise the 1D dashboard range starts empty.
    if intraday_age is None or intraday_age >= refresh_duration:
        build_intraday_history(interval=intraday_interval)
        intraday_refreshed = True

    if weekly_refreshed or intraday_refreshed:
        refresh_weekly_intraday_from_1d(interval=intraday_interval)

    # Train once after startup data warmup. Existing snapshots are skipped when
    # their asset already uses the latest available daily candle.
    refresh_all_predictions()


if __name__ == "__main__":
    build_missing_or_stale_history()
