from datetime import datetime
import math

import pandas as pd
from fastapi import HTTPException

from .market_data_config import (
    DATA_DIR,
    INTRADAY_DATA_DIR,
    INTRADAY_INTERVAL,
    RANGE_DAYS,
    WEEKLY_CHART_DAYS,
    WEEKLY_INTRADAY_DATA_DIR,
    WEEKLY_INTRADAY_INTERVAL,
    sanitize_ticker,
)
from .market_data_history import (
    filter_recent_days,
    load_daily_history_with_latest,
    load_intraday_history_with_official_close,
    load_weekly_intraday_history,
)
from .market_data_storage import latest_datetime, latest_file_mtime


def get_data_updated_at(
    ticker: str,
    *,
    range_name: str | None = None,
) -> datetime | None:
    safe = sanitize_ticker(ticker)

    if range_name:
        normalized_range = range_name.upper()

        if normalized_range == "1D":
            intraday_updated_at = latest_file_mtime(
                INTRADAY_DATA_DIR,
                f"{safe}_{INTRADAY_INTERVAL}",
            )
            daily_updated_at = latest_file_mtime(DATA_DIR, safe)

            return latest_datetime(daily_updated_at, intraday_updated_at)

        if normalized_range == "1W":
            return latest_file_mtime(
                WEEKLY_INTRADAY_DATA_DIR,
                f"{safe}_{WEEKLY_INTRADAY_INTERVAL}",
            )

    daily_updated_at = latest_file_mtime(DATA_DIR, safe)
    intraday_updated_at = latest_file_mtime(
        INTRADAY_DATA_DIR,
        f"{safe}_{INTRADAY_INTERVAL}",
    )

    return latest_datetime(daily_updated_at, intraday_updated_at)


def get_candles(
    ticker: str,
    *,
    end: str | None = None,
    limit: int | None = None,
    range_name: str | None = None,
    start: str | None = None,
) -> list[dict]:
    if range_name:
        normalized_range = range_name.upper()

        if normalized_range == "1D":
            df = load_intraday_history_with_official_close(ticker)
            return df_to_candles(df, include_time=True)

        if normalized_range == "1W":
            df = filter_recent_days(
                load_weekly_intraday_history(ticker),
                WEEKLY_CHART_DAYS,
            )
            return df_to_candles(df, include_time=True)

        if normalized_range not in RANGE_DAYS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid range '{range_name}'",
            )

        df = filter_recent_days(
            load_daily_history_with_latest(ticker),
            RANGE_DAYS[normalized_range],
        )
        return df_to_candles(df)

    df = load_daily_history_with_latest(ticker)

    if start:
        df = df[df.index >= pd.Timestamp(start)]
    if end:
        df = df[df.index <= pd.Timestamp(end)]
    if limit:
        df = df.tail(limit)

    return df_to_candles(df)


def latest_payload(ticker: str) -> dict:
    df = load_daily_history_with_latest(ticker)
    last = df.iloc[-1]

    return {
        "ticker": sanitize_ticker(ticker),
        "date": pd.Timestamp(df.index[-1]).strftime("%Y-%m-%d"),
        "data": {k: (None if pd.isna(v) else float(v)) for k, v in last.items()},
    }


def _read_number(value) -> float | None:
    if pd.isna(value):
        return None

    number = float(value)

    return number if math.isfinite(number) else None


def _snapshot_payload(ticker: str) -> dict | None:
    try:
        df = load_daily_history_with_latest(ticker)
    except HTTPException:
        return None

    if "Close" not in df.columns:
        return None

    closes = df.dropna(subset=["Close"])

    if len(closes) < 2:
        return None

    last_price = _read_number(closes["Close"].iloc[-1])
    previous_close = _read_number(closes["Close"].iloc[-2])

    if last_price is None or previous_close is None or previous_close <= 0:
        return None

    day_change = last_price - previous_close
    updated_at = get_data_updated_at(ticker)

    return {
        "symbol": sanitize_ticker(ticker),
        "name": sanitize_ticker(ticker),
        "lastPrice": last_price,
        "dayChange": day_change,
        "dayChangePercent": (day_change / previous_close) * 100,
        "updatedAt": updated_at.isoformat() if updated_at else None,
    }


def snapshot_payloads(tickers: list[str]) -> list[dict]:
    return [
        snapshot
        for ticker in tickers
        if (snapshot := _snapshot_payload(ticker)) is not None
    ]


def df_to_candles(df: pd.DataFrame, *, include_time: bool = False) -> list[dict]:
    out: list[dict] = []

    for idx, row in df.iterrows():
        timestamp = pd.Timestamp(idx)
        candle_time = (
            timestamp.isoformat()
            if include_time
            else timestamp.strftime("%Y-%m-%d")
        )

        out.append(
            {
                "t": candle_time,
                "o": None if pd.isna(row["Open"]) else float(row["Open"]),
                "h": None if pd.isna(row["High"]) else float(row["High"]),
                "l": None if pd.isna(row["Low"]) else float(row["Low"]),
                "c": None if pd.isna(row["Close"]) else float(row["Close"]),
                "v": (
                    None
                    if "Volume" not in row or pd.isna(row["Volume"])
                    else float(row["Volume"])
                ),
            }
        )

    return out
