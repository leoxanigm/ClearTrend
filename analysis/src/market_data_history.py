from datetime import datetime, timedelta, timezone

import pandas as pd
from fastapi import HTTPException

from .market_data_config import (
    ACTIVE_INTRADAY_MAX_AGE,
    DAILY_BATCH_PAUSE_SECONDS,
    DAILY_BATCH_SIZE,
    DATA_DIR,
    DEFAULT_DAILY_HISTORY_PERIOD,
    INTRADAY_BATCH_PAUSE_SECONDS,
    INTRADAY_BATCH_SIZE,
    INTRADAY_CANDLE_DURATION,
    INTRADAY_DATA_DIR,
    INTRADAY_INTERVAL,
    INTRADAY_PERIOD,
    LONG_HISTORY_PERIOD,
    LONG_HISTORY_TICKERS,
    REGULAR_STOCK_SESSION_DURATION,
    WEEKLY_INTRADAY_CACHE_DAYS,
    WEEKLY_INTRADAY_DATA_DIR,
    WEEKLY_INTRADAY_INTERVAL,
    WEEKLY_INTRADAY_PERIOD,
    WEEKLY_INTRADAY_SOURCE_MARKER,
    sanitize_ticker,
    source_ticker,
)
from .market_data_fetcher import (
    download_batch,
    extract_ticker,
    fetch_sp500_tickers,
    get_refresh_source_tickers,
    process_tickers,
)
from .market_data_storage import (
    latest_file,
    latest_file_age,
    latest_file_mtime,
    list_cached_tickers,
    read_csv,
    save_frame,
    write_refresh_marker,
)


def build_daily_history(
    sp500_period: str = DEFAULT_DAILY_HISTORY_PERIOD,
    long_period: str = LONG_HISTORY_PERIOD,
) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    sp500 = [
        ticker
        for ticker in fetch_sp500_tickers()
        if ticker not in LONG_HISTORY_TICKERS
    ]

    process_tickers(
        sp500,
        batch_size=DAILY_BATCH_SIZE,
        interval="1d",
        pause_seconds=DAILY_BATCH_PAUSE_SECONDS,
        period=sp500_period,
        target_dir=DATA_DIR,
    )
    process_tickers(
        LONG_HISTORY_TICKERS,
        batch_size=DAILY_BATCH_SIZE,
        interval="1d",
        pause_seconds=DAILY_BATCH_PAUSE_SECONDS,
        period=long_period,
        target_dir=DATA_DIR,
    )


def refresh_daily_history_for_tickers(
    tickers: list[str],
    *,
    period: str = "5d",
) -> int:
    # Refresh only the daily tail for active symbols so long-history files keep
    # their older rows while the latest official close is corrected quickly.
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    updated = 0

    for ticker in tickers:
        yahoo_ticker = source_ticker(ticker)
        df_batch = download_batch(
            [yahoo_ticker],
            interval="1d",
            period=period,
        )

        if df_batch is None or df_batch.empty:
            continue

        latest_daily = extract_ticker(df_batch, yahoo_ticker)

        if latest_daily is None or latest_daily.empty:
            continue

        try:
            existing_daily = load_daily_history(yahoo_ticker)
        except HTTPException:
            existing_daily = pd.DataFrame()

        merged = pd.concat([existing_daily, latest_daily]).sort_index()
        merged = merged[~merged.index.duplicated(keep="last")]

        save_frame(yahoo_ticker, merged, directory=DATA_DIR)
        updated += 1

    return updated


def build_intraday_history(
    tickers: list[str] | None = None,
    *,
    interval: str = INTRADAY_INTERVAL,
    period: str = INTRADAY_PERIOD,
) -> None:
    INTRADAY_DATA_DIR.mkdir(parents=True, exist_ok=True)
    source_tickers = (
        tickers
        if tickers is not None
        else get_refresh_source_tickers()
    )

    process_tickers(
        source_tickers,
        batch_size=INTRADAY_BATCH_SIZE,
        interval=interval,
        pause_seconds=INTRADAY_BATCH_PAUSE_SECONDS,
        period=period,
        target_dir=INTRADAY_DATA_DIR,
        target_marker=interval,
    )


def build_weekly_intraday_history(
    tickers: list[str] | None = None,
    *,
    interval: str = WEEKLY_INTRADAY_INTERVAL,
    period: str = WEEKLY_INTRADAY_PERIOD,
) -> None:
    WEEKLY_INTRADAY_DATA_DIR.mkdir(parents=True, exist_ok=True)
    source_tickers = (
        tickers
        if tickers is not None
        else get_refresh_source_tickers()
    )
    updated = process_tickers(
        source_tickers,
        batch_size=INTRADAY_BATCH_SIZE,
        interval=interval,
        pause_seconds=INTRADAY_BATCH_PAUSE_SECONDS,
        period=period,
        target_dir=WEEKLY_INTRADAY_DATA_DIR,
        target_marker=interval,
    )

    if updated > 0:
        write_refresh_marker(WEEKLY_INTRADAY_SOURCE_MARKER)


def _timestamp_to_utc_datetime(value: pd.Timestamp) -> datetime:
    timestamp = pd.Timestamp(value)

    if timestamp.tzinfo is None:
        timestamp = timestamp.tz_localize(timezone.utc)
    else:
        timestamp = timestamp.tz_convert(timezone.utc)

    return timestamp.to_pydatetime()


def _latest_complete_intraday_session_close(
    df: pd.DataFrame,
) -> datetime | None:
    if df.empty:
        return None

    clean = df.sort_index()
    latest_day = pd.Timestamp(clean.index[-1]).date()
    day_rows = clean.loc[
        [pd.Timestamp(idx).date() == latest_day for idx in clean.index]
    ]

    if day_rows.empty:
        return None

    first_timestamp = pd.Timestamp(day_rows.index[0])
    last_timestamp = pd.Timestamp(day_rows.index[-1])
    covered_duration = (
        last_timestamp - first_timestamp + INTRADAY_CANDLE_DURATION
    )

    if covered_duration < REGULAR_STOCK_SESSION_DURATION:
        return None

    return _timestamp_to_utc_datetime(
        last_timestamp + INTRADAY_CANDLE_DURATION,
    )


def _daily_cache_updated_after(ticker: str, timestamp: datetime) -> bool:
    daily_updated_at = latest_file_mtime(DATA_DIR, sanitize_ticker(ticker))

    return bool(daily_updated_at and daily_updated_at >= timestamp)


def _has_official_daily_close(
    ticker: str,
    intraday: pd.DataFrame,
) -> bool:
    session_close = _latest_complete_intraday_session_close(intraday)

    return bool(
        session_close and _daily_cache_updated_after(ticker, session_close)
    )


def _has_valid_latest_daily_close(daily: pd.DataFrame) -> bool:
    return bool(
        not daily.empty
        and "Close" in daily.columns
        and not pd.isna(daily["Close"].iloc[-1])
    )


def _refresh_official_daily_close_if_ready(ticker: str) -> bool:
    try:
        intraday = load_intraday_history(ticker)
    except HTTPException:
        return False

    session_close = _latest_complete_intraday_session_close(intraday)

    if session_close is None or _daily_cache_updated_after(
        ticker,
        session_close,
    ):
        return False

    return refresh_daily_history_for_tickers([source_ticker(ticker)]) > 0


def load_daily_history(ticker: str) -> pd.DataFrame:
    safe = sanitize_ticker(ticker)
    path = latest_file(DATA_DIR, safe)

    if path is None:
        raise HTTPException(
            status_code=404,
            detail=f"No data for ticker '{ticker}'",
        )

    return read_csv(path)


def load_intraday_history(ticker: str) -> pd.DataFrame:
    safe = sanitize_ticker(ticker)
    prefix = f"{safe}_{INTRADAY_INTERVAL}"
    path = latest_file(INTRADAY_DATA_DIR, prefix)

    if path is None:
        raise HTTPException(
            status_code=404,
            detail=f"No intraday data for ticker '{ticker}'",
        )

    return read_csv(path)


def load_intraday_history_with_official_close(ticker: str) -> pd.DataFrame:
    intraday = load_intraday_history(ticker)

    if not _has_official_daily_close(ticker, intraday):
        return intraday

    try:
        daily = load_daily_history(ticker)
    except HTTPException:
        return intraday

    if daily.empty or intraday.empty or "Close" not in daily.columns:
        return intraday

    latest_intraday_day = pd.Timestamp(intraday.index[-1]).date()
    latest_daily_day = pd.Timestamp(daily.index[-1]).date()

    if latest_intraday_day != latest_daily_day:
        return intraday

    official_close = daily["Close"].iloc[-1]

    if pd.isna(official_close):
        return intraday

    # The closing auction can make the official daily close differ slightly
    # from Yahoo's final 5 minute candle close.
    out = intraday.copy()
    last_index = out.index[-1]
    out.loc[last_index, "Close"] = official_close

    if "Adj Close" in out.columns:
        out.loc[last_index, "Adj Close"] = daily.get(
            "Adj Close",
            daily["Close"],
        ).iloc[-1]

    if "High" in out.columns:
        out.loc[last_index, "High"] = max(
            out.loc[last_index, "High"],
            official_close,
        )

    if "Low" in out.columns:
        out.loc[last_index, "Low"] = min(
            out.loc[last_index, "Low"],
            official_close,
        )

    return out


def load_weekly_intraday_history(ticker: str) -> pd.DataFrame:
    safe = sanitize_ticker(ticker)
    prefix = f"{safe}_{WEEKLY_INTRADAY_INTERVAL}"
    path = latest_file(WEEKLY_INTRADAY_DATA_DIR, prefix)

    if path is None:
        raise HTTPException(
            status_code=404,
            detail=f"No weekly intraday data for ticker '{ticker}'",
        )

    return read_csv(path)


def _aggregate_intraday_to_hourly(df: pd.DataFrame) -> pd.DataFrame | None:
    required_columns = ["Open", "High", "Low", "Close"]

    if any(column not in df.columns for column in required_columns):
        return None

    clean = df.dropna(subset=required_columns, how="any").sort_index()

    if clean.empty:
        return None

    aggregations = {
        "Open": "first",
        "High": "max",
        "Low": "min",
        "Close": "last",
    }

    if "Volume" in clean.columns:
        aggregations["Volume"] = "sum"

    if "Adj Close" in clean.columns:
        aggregations["Adj Close"] = "last"

    hourly = clean.resample(WEEKLY_INTRADAY_INTERVAL).agg(aggregations)
    hourly = hourly.dropna(subset=required_columns, how="any")
    hourly.index.name = "Date"

    return None if hourly.empty else hourly


def filter_recent_days(df: pd.DataFrame, days: int) -> pd.DataFrame:
    cutoff = datetime.now().date() - timedelta(days=days)
    mask = [pd.Timestamp(idx).date() >= cutoff for idx in df.index]

    return df.loc[mask]


def refresh_weekly_intraday_from_1d(tickers: list[str] | None = None) -> int:
    target_tickers = tickers if tickers is not None else list_cached_tickers()
    updated = 0

    for ticker in target_tickers:
        try:
            hourly_from_1d = _aggregate_intraday_to_hourly(
                load_intraday_history_with_official_close(ticker),
            )
        except HTTPException:
            continue

        if hourly_from_1d is None:
            continue

        try:
            weekly = load_weekly_intraday_history(ticker)
        except HTTPException:
            weekly = pd.DataFrame()

        hourly_dates = {
            pd.Timestamp(idx).date()
            for idx in hourly_from_1d.index
        }

        if not weekly.empty:
            weekly = weekly.loc[
                [
                    pd.Timestamp(idx).date() not in hourly_dates
                    for idx in weekly.index
                ]
            ]

        merged = pd.concat([weekly, hourly_from_1d]).sort_index()
        merged = merged[~merged.index.duplicated(keep="last")]
        merged = filter_recent_days(merged, WEEKLY_INTRADAY_CACHE_DAYS)

        save_frame(
            ticker,
            merged,
            directory=WEEKLY_INTRADAY_DATA_DIR,
            marker=WEEKLY_INTRADAY_INTERVAL,
        )
        updated += 1

    return updated


def _aggregate_latest_intraday_day(df: pd.DataFrame) -> pd.Series | None:
    required_columns = ["Open", "High", "Low", "Close"]

    if any(column not in df.columns for column in required_columns):
        return None

    clean = df.dropna(subset=required_columns, how="any")

    if clean.empty:
        return None

    latest_day = pd.Timestamp(clean.index[-1]).date()
    day_mask = [pd.Timestamp(idx).date() == latest_day for idx in clean.index]
    day_rows = clean.loc[day_mask]

    if day_rows.empty:
        return None

    # Fold the current session into a synthetic daily candle until Yahoo's
    # official daily close is available after the regular session.
    values = {
        "Open": day_rows["Open"].iloc[0],
        "High": day_rows["High"].max(),
        "Low": day_rows["Low"].min(),
        "Close": day_rows["Close"].iloc[-1],
        "Volume": day_rows["Volume"].sum() if "Volume" in day_rows else None,
    }

    if "Adj Close" in day_rows:
        values["Adj Close"] = values["Close"]

    return pd.Series(values, name=pd.Timestamp(latest_day))


def load_daily_history_with_latest(ticker: str) -> pd.DataFrame:
    daily = load_daily_history(ticker)

    try:
        intraday = load_intraday_history(ticker)
        latest_day = _aggregate_latest_intraday_day(intraday)
    except HTTPException:
        latest_day = None

    if latest_day is None:
        return daily

    latest_daily_day = pd.Timestamp(daily.index[-1]).date()

    if latest_day.name.date() < latest_daily_day:
        return daily

    if (
        latest_day.name.date() == latest_daily_day
        and _has_official_daily_close(ticker, intraday)
        and _has_valid_latest_daily_close(daily)
    ):
        return daily

    out = daily.copy()

    for column, value in latest_day.items():
        if column not in out.columns:
            out[column] = pd.NA

        out.loc[latest_day.name, column] = value

    return out.sort_index()


def refresh_active_ticker_if_stale(
    ticker: str,
    *,
    max_age: timedelta = ACTIVE_INTRADAY_MAX_AGE,
    range_name: str | None = None,
) -> bool:
    safe = sanitize_ticker(ticker)
    normalized_range = range_name.upper() if range_name else None
    refreshed = False

    if normalized_range == "1W" and latest_file(
        WEEKLY_INTRADAY_DATA_DIR,
        f"{safe}_{WEEKLY_INTRADAY_INTERVAL}",
    ) is None:
        build_weekly_intraday_history([source_ticker(ticker)])
        refreshed = True

    intraday_age = latest_file_age(
        INTRADAY_DATA_DIR,
        f"{safe}_{INTRADAY_INTERVAL}",
    )

    if intraday_age is None or intraday_age >= max_age:
        build_intraday_history([source_ticker(ticker)])
        refresh_weekly_intraday_from_1d([ticker])
        refreshed = True

    if _refresh_official_daily_close_if_ready(ticker):
        refreshed = True

    return refreshed
