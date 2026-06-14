import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query

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
from .ml.store import (
    load_prediction,
    prediction_status,
    select_prediction_horizon,
)
from .ml.ensemble import SUPPORTED_TICKERS


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


@app.get("/ml/assets")
def ml_assets() -> dict[str, list[str]]:
    return {
        "tickers": [
            sanitize_ticker(ticker)
            for ticker in SUPPORTED_TICKERS
        ]
    }


@app.get("/ml/status")
def ml_status() -> dict[str, list[dict]]:
    return {"assets": prediction_status()}


@app.get("/ml/analyse/{ticker}")
def ml_analyse(
    ticker: str,
    horizon: str | None = Query(None),
) -> dict:
    try:
        supported = {
            sanitize_ticker(source_ticker)
            for source_ticker in SUPPORTED_TICKERS
        }
        safe_ticker = sanitize_ticker(ticker)

        if safe_ticker not in supported:
            raise ValueError(
                f"Ticker '{ticker}' is not part of the ML asset universe"
            )

        payload = load_prediction(ticker)

        if payload is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    f"ML prediction for '{safe_ticker}' "
                    "has not been trained yet"
                ),
            )

        return select_prediction_horizon(payload, horizon)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


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
