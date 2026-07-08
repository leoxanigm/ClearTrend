from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

from .config import (
    DATA_DIR,
    INTRADAY_DATA_DIR,
    INTRADAY_INTERVAL,
    TIMESTAMP_FMT,
    WEEKLY_INTRADAY_SOURCE_MARKER,
    sanitize_ticker,
)


def save_frame(ticker: str,
                df: pd.DataFrame,
                *, directory: Path,
                marker: str | None = None) -> None:
    """Replace the current CSV snapshot for one ticker and interval."""
    safe_name = sanitize_ticker(ticker)
    stamp = datetime.now().strftime(TIMESTAMP_FMT)
    file_prefix = f"{safe_name}_{marker}" if marker else safe_name
    new_path = directory / f"{file_prefix}_{stamp}.csv"

    directory.mkdir(parents=True, exist_ok=True)
    df.to_csv(new_path)

    # Keep one current CSV per ticker/interval so reads do not merge stale
    # snapshots from older refreshes.
    for old in directory.glob(f"{file_prefix}_*.csv"):
        if old != new_path:
            old.unlink(missing_ok=True)


def latest_csv_timestamp(directory: Path,
                        pattern: str = "*.csv") -> datetime | None:
    """Read the newest timestamp encoded in matching cache filenames."""
    newest: datetime | None = None

    if not directory.exists():
        return None

    for path in directory.glob(pattern):
        stem_stamp = path.stem.rsplit("_", 1)[-1]

        try:
            ts = datetime.strptime(stem_stamp, TIMESTAMP_FMT)
        except ValueError:
            continue

        if newest is None or ts > newest:
            newest = ts

    return newest


def latest_csv_age(
    directory: Path,
    pattern: str = "*.csv",
) -> timedelta | None:
    """Measure the age of the newest matching timestamped CSV."""
    newest = latest_csv_timestamp(directory, pattern)

    return None if newest is None else datetime.now() - newest


def latest_csv_date(directory: Path) -> date | None:
    """Return the calendar date of the newest CSV snapshot."""
    newest = latest_csv_timestamp(directory)

    return None if newest is None else newest.date()


def write_refresh_marker(path: Path) -> None:
    """Persist the completion time of a refresh that has no dedicated CSV."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(datetime.now().isoformat(), encoding="utf-8")


def read_refresh_marker_date(path: Path) -> date | None:
    """Read a refresh marker while tolerating a missing or invalid file."""
    if not path.exists():
        return None

    try:
        return datetime.fromisoformat(path.read_text(encoding="utf-8")).date()
    except ValueError:
        return None


def latest_intraday_csv_age(
    interval: str = INTRADAY_INTERVAL,
) -> timedelta | None:
    """Measure freshness only for the currently configured 1D interval."""
    # Ignore old interval files after a configuration change such as 5m -> 1m.
    return latest_csv_age(
        INTRADAY_DATA_DIR,
        f"*_{interval}_*.csv",
    )


def latest_daily_csv_date() -> date | None:
    """Return the date of the newest daily market-data snapshot."""
    return latest_csv_date(DATA_DIR)


def latest_weekly_intraday_source_date() -> date | None:
    """Return when the hourly 1W cache was last downloaded from its source."""
    return read_refresh_marker_date(WEEKLY_INTRADAY_SOURCE_MARKER)


def latest_file(directory: Path, prefix: str) -> Path | None:
    """Return the newest timestamped cache matching one ticker/interval prefix."""
    newest: tuple[datetime, Path] | None = None

    for path in directory.glob(f"{prefix}_*.csv"):
        stem_stamp = path.stem.rsplit("_", 1)[-1]

        try:
            ts = datetime.strptime(stem_stamp, TIMESTAMP_FMT)
        except ValueError:
            continue

        if newest is None or ts > newest[0]:
            newest = (ts, path)

    return newest[1] if newest else None


def latest_file_mtime(directory: Path, prefix: str) -> datetime | None:
    """Expose cache freshness as UTC metadata for lightweight chart polling."""
    path = latest_file(directory, prefix)

    if path is None:
        return None

    return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)


def latest_file_age(directory: Path, prefix: str) -> timedelta | None:
    updated_at = latest_file_mtime(directory, prefix)

    return None if updated_at is None else datetime.now(timezone.utc) - updated_at


def latest_datetime(*values: datetime | None) -> datetime | None:
    """Select the freshest timestamp when a chart combines multiple caches."""
    timestamps = [value for value in values if value is not None]

    return max(timestamps) if timestamps else None


def read_csv(path: Path) -> pd.DataFrame:
    """Restore one OHLCV cache with a parsed Date index."""
    df = pd.read_csv(path, index_col=0, parse_dates=True)
    df.index.name = "Date"

    return df


def list_cached_tickers() -> list[str]:
    """List the daily-cache universe exposed to search and watchlists."""
    seen: set[str] = set()

    for path in DATA_DIR.glob("*.csv"):
        seen.add(path.stem.rsplit("_", 1)[0])

    return sorted(seen)
