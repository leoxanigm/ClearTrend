from datetime import date, datetime, timedelta

from .market_data import (
    build_daily_history,
    build_intraday_history,
    build_weekly_intraday_history,
    latest_daily_csv_date,
    latest_intraday_csv_age,
    latest_weekly_intraday_source_date,
    refresh_weekly_intraday_from_1d,
)

INTRADAY_MAX_AGE = timedelta(hours=1)


def _refreshed_today(refresh_date: date | None) -> bool:
    return refresh_date is not None and refresh_date == datetime.now().date()


def build_missing_or_stale_history() -> None:
    weekly_refreshed = False
    intraday_refreshed = False

    # Warm daily history before the API starts when the cache is missing/stale.
    if not _refreshed_today(latest_daily_csv_date()):
        build_daily_history()

    # 1W hourly cache is rebuilt from yfinance once per day, then completed
    # from the 1D/5m cache below.
    if not _refreshed_today(latest_weekly_intraday_source_date()):
        build_weekly_intraday_history()
        weekly_refreshed = True

    intraday_age = latest_intraday_csv_age()

    # Warm intraday cache too, otherwise the 1D dashboard range starts empty.
    if intraday_age is None or intraday_age >= INTRADAY_MAX_AGE:
        build_intraday_history()
        intraday_refreshed = True

    if weekly_refreshed or intraday_refreshed:
        refresh_weekly_intraday_from_1d()


if __name__ == "__main__":
    build_missing_or_stale_history()
