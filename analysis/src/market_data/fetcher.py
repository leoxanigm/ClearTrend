import io
import time
from pathlib import Path

import pandas as pd
import requests
import yfinance as yf

from .config import (
    LONG_HISTORY_TICKERS,
    SP500_WIKI_URL,
    source_ticker,
)
from .storage import list_cached_tickers, save_frame


def fetch_sp500_tickers() -> list[str]:
    """Read the current S&P 500 symbol universe from Wikipedia."""
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    resp = requests.get(SP500_WIKI_URL, headers=headers, timeout=15)
    resp.raise_for_status()
    df = pd.read_html(io.StringIO(resp.text), attrs={"id": "constituents"})[0]

    return df["Symbol"].str.replace(".", "-", regex=False).tolist()


def get_refresh_source_tickers() -> list[str]:
    """Reuse the cached universe so intraday refreshes do not rediscover symbols."""
    cached = list_cached_tickers()

    if cached:
        # Refresh the same universe already present on disk; the first daily
        # build is the only step that expands the ticker list from Wikipedia.
        return [source_ticker(ticker) for ticker in cached]

    return [*fetch_sp500_tickers(), *LONG_HISTORY_TICKERS]


def download_batch(
    tickers: list[str],
    *,
    interval: str,
    period: str,
) -> pd.DataFrame | None:
    """Download one Yahoo batch for the period and interval chosen by history.py."""
    try:
        return yf.download(
            tickers,
            period=period,
            interval=interval,
            group_by="ticker",
            auto_adjust=False,
            progress=False,
            threads=True,
        )
    except Exception:
        return None


def extract_ticker(df_multi: pd.DataFrame, ticker: str) -> pd.DataFrame | None:
    """Extract one ticker frame from either yfinance column layout."""
    try:
        if isinstance(df_multi.columns, pd.MultiIndex):
            if ticker in df_multi.columns.get_level_values(0):
                sub = df_multi.xs(ticker, axis=1, level=0).copy()
            elif (
                df_multi.columns.nlevels > 1
                and ticker in df_multi.columns.get_level_values(1)
            ):
                sub = df_multi.xs(ticker, axis=1, level=1).copy()
            else:
                return None
        else:
            sub = df_multi.copy()

        sub = sub.dropna(how="all")

        if not isinstance(sub, pd.DataFrame) or sub.empty:
            return None

        sub.index.name = "Date"
        return sub
    except KeyError:
        return None


def process_tickers(
    tickers: list[str],
    *,
    batch_size: int,
    interval: str,
    pause_seconds: float,
    period: str,
    target_dir: Path,
    target_marker: str | None = None,
) -> int:
    """Download, split, and persist a complete ticker universe in bounded batches."""
    updated = 0
    batches = [
        tickers[i:i + batch_size]
        for i in range(0, len(tickers), batch_size)
    ]

    for batch in batches:
        df_batch = download_batch(batch, interval=interval, period=period)

        if df_batch is None or df_batch.empty:
            continue

        for ticker in batch:
            sub = extract_ticker(df_batch, ticker)

            if sub is None:
                continue

            save_frame(
                ticker,
                sub,
                directory=target_dir,
                marker=target_marker,
            )
            updated += 1

        time.sleep(pause_seconds)

    return updated
