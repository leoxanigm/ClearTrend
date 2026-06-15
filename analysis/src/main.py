import asyncio
import logging
from contextlib import asynccontextmanager

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)-9s %(name)s - %(message)s",
)

from fastapi import FastAPI, HTTPException, Query

logger = logging.getLogger(__name__)

from .market_data import (
    get_candles,
    get_data_updated_at,
    latest_payload,
    list_cached_tickers,
    performance_payloads,
    resolve_intraday_interval,
    sanitize_ticker,
    snapshot_payloads,
)
from .config import get_finance_refresh_rate_duration
from .market_data.config import intraday_interval_for_refresh_seconds
from .database_builder import build_missing_or_stale_history
from .scheduler import run_market_data_scheduler
from .ml.store import (
    load_prediction,
    prediction_status,
    select_prediction_horizon,
)
from .ml.ensemble import SUPPORTED_TICKERS


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Own the background market scheduler for the lifetime of FastAPI
    logger.info("Analysis service ready, starting background warmup and scheduler")
    warmup_task = asyncio.create_task(
        asyncio.to_thread(build_missing_or_stale_history)
    )
    refresh_task = asyncio.create_task(run_market_data_scheduler())

    try:
        yield
    finally:
        refresh_task.cancel()
        warmup_task.cancel()
        try:
            await asyncio.gather(refresh_task, warmup_task, return_exceptions=True)
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="Transcendence Analysis Service",
    lifespan=lifespan,
)


def _configured_intraday_interval() -> str:
    """Resolve the admin setting once per API request into a Yahoo interval."""
    refresh_duration = get_finance_refresh_rate_duration()

    return intraday_interval_for_refresh_seconds(
        int(refresh_duration.total_seconds())
    )


def _chart_interval(
    ticker: str,
    range_name: str | None,
    configured_intraday_interval: str,
) -> str:
    """Describe the granularity actually served to the dashboard."""
    normalized_range = range_name.upper() if range_name else None

    if normalized_range == "1D":
        return resolve_intraday_interval(
            ticker,
            configured_intraday_interval,
        )
    if normalized_range == "1W":
        return "1h"

    return "1d"


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
    return latest_payload(
        ticker,
        intraday_interval=_configured_intraday_interval(),
    )


@app.get("/snapshots")
def snapshots(symbols: str = Query("")) -> dict[str, list[dict]]:
    """Serve compact current values for a batch of watchlist symbols."""
    tickers = [
        symbol.strip()
        for symbol in symbols.split(",")
        if symbol.strip()
    ][:999]

    return {
        "snapshots": snapshot_payloads(
            tickers,
            intraday_interval=_configured_intraday_interval(),
        )
    }


@app.get("/performances")
def performances(
    range_name: str = Query("1D", alias="range"),
    symbols: str = Query(""),
) -> dict[str, list[dict]]:
    """Serve first-to-last close performance for one dashboard range."""
    tickers = [
        symbol.strip()
        for symbol in symbols.split(",")
        if symbol.strip()
    ][:999]

    return {
        "performances": performance_payloads(
            tickers,
            range_name,
            intraday_interval=_configured_intraday_interval(),
        ),
    }


@app.get("/candles/{ticker}/meta")
def candles_meta(
    ticker: str,
    range_name: str | None = Query(None, alias="range"),
) -> dict:
    """Expose only cache freshness metadata for lightweight client polling."""
    configured_interval = _configured_intraday_interval()
    updated_at = get_data_updated_at(
        ticker,
        intraday_interval=configured_interval,
        range_name=range_name,
    )

    return {
        "ticker": sanitize_ticker(ticker),
        "interval": _chart_interval(
            ticker,
            range_name,
            configured_interval,
        ),
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
    """Serve normalized OHLCV candles for one ticker and product range."""
    configured_interval = _configured_intraday_interval()
    updated_at = get_data_updated_at(
        ticker,
        intraday_interval=configured_interval,
        range_name=range_name,
    )

    # Keep endpoint behavior thin; range selection, intraday overlay, and CSV
    # normalization live behind the market_data facade.
    return {
        "ticker": sanitize_ticker(ticker),
        "interval": _chart_interval(
            ticker,
            range_name,
            configured_interval,
        ),
        "updatedAt": updated_at.isoformat() if updated_at else None,
        "candles": get_candles(
            ticker,
            end=end,
            intraday_interval=configured_interval,
            limit=limit,
            range_name=range_name,
            start=start,
        ),
    }
