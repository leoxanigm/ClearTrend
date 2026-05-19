import io
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
import requests
import yfinance as yf

TIMESTAMP_FMT = "%Y%m%dT%H%M%S"

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "history"
SP500_WIKI_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"

# Tickers needing 5y of history (overrides the 1y default when overlapping)
LONG_HISTORY_TICKERS = [
    "^GSPC",    # S&P 500 index
    "^IXIC",    # Nasdaq
    "BTC-USD",  # Bitcoin
    "ETH-USD",  # Ethereum
    "GOOGL",    # Google
    "NVDA",     # Nvidia
]

BATCH_SIZE = 50
BATCH_PAUSE_SECONDS = 0.5
INTERVAL = "1d"


def fetch_sp500_tickers() -> list[str]:
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    resp = requests.get(SP500_WIKI_URL, headers=headers, timeout=15)
    resp.raise_for_status()
    df = pd.read_html(io.StringIO(resp.text), attrs={"id": "constituents"})[0]
    tickers = df["Symbol"].str.replace(".", "-", regex=False).tolist()
    return tickers


def download_batch(tickers: list[str], period: str) -> pd.DataFrame | None:
    try:
        return yf.download(
            tickers,
            period=period,
            interval=INTERVAL,
            group_by="ticker",
            auto_adjust=False,
            progress=False,
            threads=True,
        )
    except Exception:
        return None


def extract_ticker(df_multi: pd.DataFrame, ticker: str) -> pd.DataFrame | None:
    try:
        if isinstance(df_multi.columns, pd.MultiIndex) and len(df_multi.columns.levels[0]) > 1:
            sub = df_multi[ticker].copy()
        else:
            sub = df_multi.copy()
        sub = sub.dropna(how="all")
        if not isinstance(sub, pd.DataFrame) or sub.empty:
            return None
        sub.index.name = "Date"
        return sub
    except KeyError:
        return None


def save_history(ticker: str, df: pd.DataFrame) -> None:
    safe_name = ticker.replace("/", "_").replace("^", "")
    stamp = datetime.now().strftime(TIMESTAMP_FMT)
    new_path = DATA_DIR / f"{safe_name}_{stamp}.csv"
    df.to_csv(new_path)
    for old in DATA_DIR.glob(f"{safe_name}_*.csv"):
        if old != new_path:
            old.unlink()


def latest_csv_age() -> timedelta | None:
    if not DATA_DIR.exists():
        return None
    newest: datetime | None = None
    for path in DATA_DIR.glob("*.csv"):
        stem_stamp = path.stem.rsplit("_", 1)[-1]
        try:
            ts = datetime.strptime(stem_stamp, TIMESTAMP_FMT)
        except ValueError:
            continue
        if newest is None or ts > newest:
            newest = ts
    if newest is None:
        return None
    return datetime.now() - newest


def _process(tickers: list[str], period: str) -> tuple[int, list[str]]:
    ok = 0
    failed: list[str] = []
    batches = [tickers[i:i + BATCH_SIZE] for i in range(0, len(tickers), BATCH_SIZE)]
    for batch in batches:
        df_batch = download_batch(batch, period)
        if df_batch is None or df_batch.empty:
            failed.extend(batch)
            continue
        for ticker in batch:
            sub = extract_ticker(df_batch, ticker)
            if sub is None:
                failed.append(ticker)
                continue
            save_history(ticker, sub)
            ok += 1
        time.sleep(BATCH_PAUSE_SECONDS)
    return ok, failed


def build(sp500_period: str = "1y", long_period: str = "5y") -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    sp500 = [t for t in fetch_sp500_tickers() if t not in LONG_HISTORY_TICKERS]

    _process(sp500, sp500_period)
    _process(LONG_HISTORY_TICKERS, long_period)


if __name__ == "__main__":
    """
    The CSV name is suffixed with its creation date.
    If the most recent CSV is less than 24h old, exit immediately. Otherwise rebuild.
    """
    age = latest_csv_age()
    if age is not None and age < timedelta(hours=24):
        sys.exit(0)
    build()
