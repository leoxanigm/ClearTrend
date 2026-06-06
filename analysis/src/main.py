import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query

from .market_data import (
    get_candles,
    get_data_updated_at,
    latest_payload,
    list_cached_tickers,
    performance_payloads,
    sanitize_ticker,
    snapshot_payloads,
)
from .scheduler import run_market_data_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run cache refreshes in the background; Docker still performs an initial
    # warmup through database_builder before uvicorn starts.
    refresh_task = asyncio.create_task(run_market_data_scheduler())

    try:
        yield
    finally:
        refresh_task.cancel()
        try:
            await refresh_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="Transcendence Analysis Service",
    lifespan=lifespan,
)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Analysis service is running"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "analysis"}


@app.get("/tickers")
def tickers() -> dict[str, list[str]]:
    return {"tickers": list_cached_tickers()}


@app.get("/history/{ticker}/latest")
def latest(ticker: str) -> dict:
    return latest_payload(ticker)


@app.get("/snapshots")
def snapshots(symbols: str = Query("")) -> dict[str, list[dict]]:
    tickers = [
        symbol.strip()
        for symbol in symbols.split(",")
        if symbol.strip()
    ][:999]

    return {"snapshots": snapshot_payloads(tickers)}


@app.get("/performances")
def performances(
    range_name: str = Query("1D", alias="range"),
    symbols: str = Query(""),
) -> dict[str, list[dict]]:
    tickers = [
        symbol.strip()
        for symbol in symbols.split(",")
        if symbol.strip()
    ][:999]

    return {
        "performances": performance_payloads(tickers, range_name),
    }


@app.get("/candles/{ticker}/meta")
def candles_meta(
    ticker: str,
    range_name: str | None = Query(None, alias="range"),
) -> dict:
    updated_at = get_data_updated_at(ticker, range_name=range_name)

    return {
        "ticker": sanitize_ticker(ticker),
        "updatedAt": updated_at.isoformat() if updated_at else None,
    }


@app.get("/candles/{ticker}")
def candles(
    ticker: str,
    end: str | None = Query(None),
    limit: int | None = Query(None, ge=1, le=10000),
    range_name: str | None = Query(None, alias="range"),
    start: str | None = Query(None),
) -> dict:
    updated_at = get_data_updated_at(ticker, range_name=range_name)

    # Keep endpoint behavior thin; range selection, intraday overlay, and CSV
    # normalization live behind the market_data facade.
    return {
        "ticker": sanitize_ticker(ticker),
        "updatedAt": updated_at.isoformat() if updated_at else None,
        "candles": get_candles(
            ticker,
            end=end,
            limit=limit,
            range_name=range_name,
            start=start,
        ),
    }
