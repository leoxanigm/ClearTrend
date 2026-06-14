from datetime import timedelta
from pathlib import Path

TIMESTAMP_FMT = "%Y%m%dT%H%M%S"

BASE_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR = BASE_DATA_DIR / "history"
INTRADAY_DATA_DIR = BASE_DATA_DIR / "intraday"
WEEKLY_INTRADAY_DATA_DIR = BASE_DATA_DIR / "weekly_intraday"
WEEKLY_INTRADAY_SOURCE_MARKER = WEEKLY_INTRADAY_DATA_DIR / "_yfinance_refresh.txt"

SP500_WIKI_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"

# Default S&P 500 assets only need enough daily data for product charts.
DEFAULT_DAILY_HISTORY_PERIOD = "1y"

# Keep a deeper history for assets used in AI studies, trend analysis, and
# longer horizon experiments.
LONG_HISTORY_PERIOD = "5y"
LONG_HISTORY_TICKERS = [
    "^GSPC",    # S&P 500 index
    "^IXIC",    # Nasdaq Composite
    "BTC-USD",  # Bitcoin
    "ETH-USD",  # Ethereum
    "GC=F",     # Gold futures
    "GOOGL",    # Google / Alphabet
    "NVDA",     # Nvidia
]
SOURCE_TICKER_BY_SAFE = {
    "GSPC": "^GSPC",
    "IXIC": "^IXIC",
}

# Download batching limits upstream request volume for the dashboard universe.
DAILY_BATCH_SIZE = 50
DAILY_BATCH_PAUSE_SECONDS = 0.5
INTRADAY_BATCH_SIZE = 25
INTRADAY_BATCH_PAUSE_SECONDS = 1.0

# The admin refresh setting controls both the scheduler cadence and the Yahoo
# interval used by the 1D dashboard. Keep the mapping limited to intervals
# supported by yfinance for a one-day download window.
INTRADAY_PERIOD = "1d"
DEFAULT_INTRADAY_REFRESH_SECONDS = 300
INTRADAY_INTERVAL_BY_REFRESH_SECONDS = {
    60: "1m",
    300: "5m",
    900: "15m",
}
INTRADAY_CANDLE_DURATION_BY_INTERVAL = {
    "1m": timedelta(minutes=1),
    "5m": timedelta(minutes=5),
    "15m": timedelta(minutes=15),
}
INTRADAY_INTERVAL = INTRADAY_INTERVAL_BY_REFRESH_SECONDS[
    DEFAULT_INTRADAY_REFRESH_SECONDS
]
INTRADAY_CANDLE_DURATION = INTRADAY_CANDLE_DURATION_BY_INTERVAL[
    INTRADAY_INTERVAL
]

# Wait briefly after a theoretical candle boundary so Yahoo has time to publish it.
ACTIVE_INTRADAY_REFRESH_DELAY = timedelta(seconds=30)
REGULAR_STOCK_SESSION_DURATION = timedelta(hours=6, minutes=30)

# 1W dashboard candles are stored separately at hourly resolution. The cache
# retains 30 days, while the product view returns only the latest seven days.
WEEKLY_INTRADAY_PERIOD = "30d"
WEEKLY_INTRADAY_INTERVAL = "1h"
WEEKLY_INTRADAY_CACHE_DAYS = 30
WEEKLY_CHART_DAYS = 7

# Longer product ranges use daily caches and these rolling calendar windows.
RANGE_DAYS = {
    "1M": 31,
    "3M": 90,
    "1Y": 365,
}


def sanitize_ticker(ticker: str) -> str:
    """Convert provider symbols into stable cache and public API identifiers."""
    return ticker.replace("/", "_").replace("^", "").upper()


def source_ticker(ticker: str) -> str:
    """Restore provider-specific symbols when a sanitized identifier is received."""
    safe = sanitize_ticker(ticker)

    return SOURCE_TICKER_BY_SAFE.get(safe, ticker)


def intraday_interval_for_refresh_seconds(seconds: int) -> str:
    """Translate the persisted admin frequency into a Yahoo candle interval."""
    return INTRADAY_INTERVAL_BY_REFRESH_SECONDS.get(
        seconds,
        INTRADAY_INTERVAL,
    )


def intraday_duration_for_interval(interval: str) -> timedelta:
    """Return the logical duration represented by one intraday candle."""
    return INTRADAY_CANDLE_DURATION_BY_INTERVAL.get(
        interval,
        INTRADAY_CANDLE_DURATION,
    )
