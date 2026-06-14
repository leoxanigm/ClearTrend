from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path

import pandas as pd
from fastapi import HTTPException

from .config import (
    DAILY_BATCH_PAUSE_SECONDS,
    DAILY_BATCH_SIZE,
    DATA_DIR,
    DEFAULT_DAILY_HISTORY_PERIOD,
    INTRADAY_BATCH_PAUSE_SECONDS,
    INTRADAY_BATCH_SIZE,
    INTRADAY_CANDLE_DURATION,
    INTRADAY_CANDLE_DURATION_BY_INTERVAL,
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
    intraday_duration_for_interval,
    sanitize_ticker,
)
from .fetcher import (
    fetch_sp500_tickers,
    get_refresh_source_tickers,
    process_tickers,
)
from .storage import (
    latest_file,
    latest_file_mtime,
    list_cached_tickers,
    read_csv,
    save_frame,
    write_refresh_marker,
)

INTRADAY_TRANSITION_REFERENCE_MAX_AGE = timedelta(minutes=30)


def build_daily_history(
    sp500_period: str = DEFAULT_DAILY_HISTORY_PERIOD,
    long_period: str = LONG_HISTORY_PERIOD,
) -> None:
    """Refresh daily caches, keeping longer histories for selected assets."""
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


def build_intraday_history(
    tickers: list[str] | None = None,
    *,
    interval: str = INTRADAY_INTERVAL,
    period: str = INTRADAY_PERIOD,
) -> None:
    """Refresh the short intraday cache used by the 1D chart."""
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
    """Refresh the persisted hourly history used by the 1W chart."""
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
    *,
    candle_duration: timedelta = INTRADAY_CANDLE_DURATION,
) -> datetime | None:
    """Return session close only when the intraday frame covers a full market day."""
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
        last_timestamp - first_timestamp + candle_duration
    )

    if covered_duration < REGULAR_STOCK_SESSION_DURATION:
        return None

    return _timestamp_to_utc_datetime(
        last_timestamp + candle_duration,
    )


def _daily_cache_updated_after(ticker: str, timestamp: datetime) -> bool:
    daily_updated_at = latest_file_mtime(DATA_DIR, sanitize_ticker(ticker))

    return bool(daily_updated_at and daily_updated_at >= timestamp)


def _has_official_daily_close(
    ticker: str,
    intraday: pd.DataFrame,
    *,
    interval: str = INTRADAY_INTERVAL,
) -> bool:
    session_close = _latest_complete_intraday_session_close(
        intraday,
        candle_duration=intraday_duration_for_interval(interval),
    )

    return bool(
        session_close and _daily_cache_updated_after(ticker, session_close)
    )


def _has_valid_latest_daily_close(daily: pd.DataFrame) -> bool:
    return bool(
        not daily.empty
        and "Close" in daily.columns
        and not pd.isna(daily["Close"].iloc[-1])
    )


def _read_cached_history(
    path: Path,
    *,
    ticker: str,
    data_kind: str,
) -> pd.DataFrame:
    """Read one cache and discard corrupt CSV files so they can be rebuilt."""
    try:
        return read_csv(path)
    except (pd.errors.EmptyDataError, pd.errors.ParserError):
        path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=404,
            detail=f"No valid {data_kind} data for ticker '{ticker}'",
        ) from None


def load_daily_history(ticker: str) -> pd.DataFrame:
    """Load the newest daily cache for a sanitized ticker."""
    safe = sanitize_ticker(ticker)
    path = latest_file(DATA_DIR, safe)

    if path is None:
        raise HTTPException(
            status_code=404,
            detail=f"No data for ticker '{ticker}'",
        )

    return _read_cached_history(
        path,
        ticker=ticker,
        data_kind="daily",
    )


def _utc_index_summary(
    df: pd.DataFrame,
) -> tuple[pd.Timestamp, pd.Timestamp, int] | None:
    """Return comparable UTC bounds and row count for one market-data frame."""
    if df.empty:
        return None

    index = pd.to_datetime(df.index, utc=True).drop_duplicates().sort_values()

    return pd.Timestamp(index[0]), pd.Timestamp(index[-1]), len(index)


@lru_cache(maxsize=4096)
def _cache_covers_reference(
    candidate_path_value: str,
    candidate_mtime_ns: int,
    candidate_size: int,
    candidate_interval: str,
    reference_path_value: str,
    reference_mtime_ns: int,
    reference_size: int,
    reference_interval: str,
) -> bool:
    """Check that a newly selected interval preserves the visible 1D history."""
    # mtimes and sizes are part of the cache key so replacing either CSV
    # automatically invalidates this result.
    del candidate_mtime_ns, candidate_size, reference_mtime_ns, reference_size

    try:
        candidate_summary = _utc_index_summary(
            read_csv(Path(candidate_path_value))
        )
        reference_summary = _utc_index_summary(
            read_csv(Path(reference_path_value))
        )
    except (OSError, pd.errors.EmptyDataError, pd.errors.ParserError):
        return False

    if candidate_summary is None or reference_summary is None:
        return False

    candidate_start, candidate_end, candidate_count = candidate_summary
    reference_start, reference_end, reference_count = reference_summary
    candidate_duration = intraday_duration_for_interval(candidate_interval)
    reference_duration = intraday_duration_for_interval(reference_interval)
    tolerance = max(candidate_duration, reference_duration)
    candidate_span = candidate_end - candidate_start
    reference_span = reference_end - reference_start
    has_expected_detail = (
        candidate_duration >= reference_duration
        or (
            candidate_count * candidate_duration.total_seconds()
            >= (
                reference_count
                * reference_duration.total_seconds()
                * 0.8
            )
        )
    )

    # The new cache may shift by one coarse candle on continuous markets, but
    # it must preserve both the visible duration and the finer point density.
    return bool(
        candidate_end + tolerance >= reference_end
        and candidate_span + tolerance >= reference_span
        and has_expected_detail
    )


def resolve_intraday_interval(
    ticker: str,
    preferred_interval: str = INTRADAY_INTERVAL,
) -> str:
    """Switch intervals only when the preferred cache preserves chart coverage."""
    safe = sanitize_ticker(ticker)

    # An admin change takes effect before the next scheduler download finishes.
    # Keep every candidate path so coverage can be compared before switching.
    candidates: list[tuple[int, bool, str, Path]] = []

    for interval in INTRADAY_CANDLE_DURATION_BY_INTERVAL:
        path = latest_file(INTRADAY_DATA_DIR, f"{safe}_{interval}")

        if path is not None:
            stat = path.stat()
            candidates.append(
                (
                    stat.st_mtime_ns,
                    interval == preferred_interval,
                    interval,
                    path,
                )
            )

    if not candidates:
        return preferred_interval

    freshest = max(candidates)
    freshest_mtime_ns, _, freshest_interval, freshest_path = freshest

    if freshest_interval != preferred_interval:
        return freshest_interval

    references = [
        candidate
        for candidate in candidates
        if candidate[2] != preferred_interval
    ]

    if not references:
        return preferred_interval

    reference_mtime_ns, _, reference_interval, reference_path = max(references)
    transition_age = timedelta(
        seconds=(freshest_mtime_ns - reference_mtime_ns) / 1_000_000_000
    )

    # Old caches from a previous day are not useful transition references.
    if transition_age > INTRADAY_TRANSITION_REFERENCE_MAX_AGE:
        return preferred_interval

    candidate_stat = freshest_path.stat()
    reference_stat = reference_path.stat()

    if _cache_covers_reference(
        str(freshest_path),
        candidate_stat.st_mtime_ns,
        candidate_stat.st_size,
        preferred_interval,
        str(reference_path),
        reference_stat.st_mtime_ns,
        reference_stat.st_size,
        reference_interval,
    ):
        return preferred_interval

    return reference_interval


def load_intraday_history(
    ticker: str,
    *,
    interval: str = INTRADAY_INTERVAL,
) -> pd.DataFrame:
    """Load the newest configured intraday cache used by the 1D visualization."""
    safe = sanitize_ticker(ticker)
    effective_interval = resolve_intraday_interval(ticker, interval)
    prefix = f"{safe}_{effective_interval}"
    path = latest_file(INTRADAY_DATA_DIR, prefix)

    if path is None:
        raise HTTPException(
            status_code=404,
            detail=f"No intraday data for ticker '{ticker}'",
        )

    return _read_cached_history(
        path,
        ticker=ticker,
        data_kind="intraday",
    )


def load_intraday_history_with_official_close(
    ticker: str,
    *,
    interval: str = INTRADAY_INTERVAL,
) -> pd.DataFrame:
    """Replace the last intraday close once the official daily close is available."""
    effective_interval = resolve_intraday_interval(ticker, interval)
    intraday = load_intraday_history(
        ticker,
        interval=effective_interval,
    )

    if not _has_official_daily_close(
        ticker,
        intraday,
        interval=effective_interval,
    ):
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
    # from Yahoo's final intraday candle close.
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
    """Load the persisted hourly cache used by weekly charts."""
    safe = sanitize_ticker(ticker)
    prefix = f"{safe}_{WEEKLY_INTRADAY_INTERVAL}"
    path = latest_file(WEEKLY_INTRADAY_DATA_DIR, prefix)

    if path is None:
        raise HTTPException(
            status_code=404,
            detail=f"No weekly intraday data for ticker '{ticker}'",
        )

    return _read_cached_history(
        path,
        ticker=ticker,
        data_kind="weekly intraday",
    )


def _aggregate_intraday_to_hourly(df: pd.DataFrame) -> pd.DataFrame | None:
    """Aggregate OHLCV correctly: first open, extrema, last close, summed volume."""
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
    """Keep only rows inside the requested rolling calendar window."""
    cutoff = datetime.now().date() - timedelta(days=days)
    mask = [pd.Timestamp(idx).date() >= cutoff for idx in df.index]

    return df.loc[mask]


def refresh_weekly_intraday_from_1d(
    tickers: list[str] | None = None,
    *,
    interval: str = INTRADAY_INTERVAL,
) -> int:
    """Merge the newest 1D data into hourly caches without duplicate timestamps."""
    target_tickers = tickers if tickers is not None else list_cached_tickers()
    updated = 0

    for ticker in target_tickers:
        try:
            hourly_from_1d = _aggregate_intraday_to_hourly(
                load_intraday_history_with_official_close(
                    ticker,
                    interval=interval,
                ),
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
    """Fold the active intraday session into one provisional daily OHLCV row."""
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


def load_daily_history_with_latest(
    ticker: str,
    *,
    interval: str = INTRADAY_INTERVAL,
) -> pd.DataFrame:
    """Overlay the active session until the provider publishes its daily candle."""
    daily = load_daily_history(ticker)

    try:
        effective_interval = resolve_intraday_interval(ticker, interval)
        intraday = load_intraday_history(
            ticker,
            interval=effective_interval,
        )
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
        and _has_official_daily_close(
            ticker,
            intraday,
            interval=effective_interval,
        )
        and _has_valid_latest_daily_close(daily)
    ):
        return daily

    out = daily.copy()

    for column, value in latest_day.items():
        if column not in out.columns:
            out[column] = pd.NA

        out.loc[latest_day.name, column] = value

    return out.sort_index()
