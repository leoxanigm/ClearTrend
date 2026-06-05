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
    "GOOGL",    # Google / Alphabet
    "NVDA",     # Nvidia
]
SOURCE_TICKER_BY_SAFE = {
    "GSPC": "^GSPC",
    "IXIC": "^IXIC",
}

# Yahoo calls are grouped by batch to reduce request volume and avoid hammering
# the upstream service.
DAILY_BATCH_SIZE = 50
DAILY_BATCH_PAUSE_SECONDS = 0.5
INTRADAY_BATCH_SIZE = 25
INTRADAY_BATCH_PAUSE_SECONDS = 1.0
INTRADAY_PERIOD = "1d"
INTRADAY_INTERVAL = "5m"
INTRADAY_CANDLE_DURATION = timedelta(minutes=5)
ACTIVE_INTRADAY_REFRESH_DELAY = timedelta(seconds=30)
REGULAR_STOCK_SESSION_DURATION = timedelta(hours=6, minutes=30)
WEEKLY_INTRADAY_PERIOD = "30d"
WEEKLY_INTRADAY_INTERVAL = "1h"
WEEKLY_INTRADAY_CACHE_DAYS = 30
WEEKLY_CHART_DAYS = 7

RANGE_DAYS = {
    "1M": 31,
    "3M": 90,
    "1Y": 365,
}


def sanitize_ticker(ticker: str) -> str:
    return ticker.replace("/", "_").replace("^", "").upper()


def source_ticker(ticker: str) -> str:
    safe = sanitize_ticker(ticker)

    return SOURCE_TICKER_BY_SAFE.get(safe, ticker)
