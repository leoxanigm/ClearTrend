from __future__ import annotations

import json
import logging
import os
import threading
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from ..market_data.config import BASE_DATA_DIR, LONG_HISTORY_TICKERS, sanitize_ticker
from ..market_data.history import load_daily_history
from .regression import clean_completed_market_frame
from .ensemble import analyze_asset

logger = logging.getLogger(__name__)

PREDICTION_DIR = BASE_DATA_DIR / "ml_predictions"
PREDICTION_SCHEMA_VERSION = 1
MODEL_VERSION = "ridge100-reddit50-daily-social-calendar-v8"
_REFRESH_LOCK = threading.Lock()


def _supported_ticker(ticker: str) -> str:
    safe = sanitize_ticker(ticker)
    supported_by_safe = {
        sanitize_ticker(source_ticker): source_ticker
        for source_ticker in LONG_HISTORY_TICKERS
    }

    if safe not in supported_by_safe:
        raise ValueError(
            f"Ticker '{ticker}' is not part of the ML asset universe"
        )

    return supported_by_safe[safe]


def _prediction_path(
    ticker: str,
    *,
    directory: Path = PREDICTION_DIR,
) -> Path:
    return directory / f"{sanitize_ticker(ticker)}.json"


def market_data_as_of(ticker: str) -> str:
    source_ticker = _supported_ticker(ticker)
    history = clean_completed_market_frame(
        load_daily_history(source_ticker)
    ).sort_index()

    if history.empty:
        raise ValueError(f"No daily history is available for '{ticker}'")

    return pd.Timestamp(history.index[-1]).date().isoformat()


def load_prediction(
    ticker: str,
    *,
    directory: Path = PREDICTION_DIR,
) -> dict | None:
    path = _prediction_path(ticker, directory=directory)

    if not path.exists():
        return None

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        logger.exception("Invalid ML prediction snapshot: %s", path)
        return None

    if (
        not isinstance(payload, dict)
        or payload.get("schemaVersion") != PREDICTION_SCHEMA_VERSION
        or not isinstance(payload.get("predictions"), list)
    ):
        return None

    return payload


def save_prediction(
    ticker: str,
    payload: dict,
    *,
    directory: Path = PREDICTION_DIR,
) -> Path:
    path = _prediction_path(ticker, directory=directory)
    temporary_path = path.with_suffix(
        f".{os.getpid()}.{threading.get_ident()}.tmp"
    )
    directory.mkdir(parents=True, exist_ok=True)
    temporary_path.write_text(
        json.dumps(payload, ensure_ascii=True, indent=2),
        encoding="utf-8",
    )
    temporary_path.replace(path)

    return path


def _timestamp_is_today(value: object) -> bool:
    try:
        timestamp = datetime.fromisoformat(
            str(value or "").replace("Z", "+00:00")
        )
    except ValueError:
        return False

    return (
        timestamp.astimezone(timezone.utc).date()
        == datetime.now(timezone.utc).date()
    )


def prediction_is_current(ticker: str, payload: dict | None) -> bool:
    if payload is None:
        return False

    try:
        social_configured = bool(os.getenv("QWEN_API_KEY", "").strip())
        social_attempt_is_current = (
            not social_configured
            or _timestamp_is_today(payload.get("socialAttemptedAt"))
        )

        return (
            _timestamp_is_today(payload.get("trainedAt"))
            and payload.get("modelVersion") == MODEL_VERSION
            and payload.get("marketDataAsOf") == market_data_as_of(ticker)
            and payload.get("socialEnabled") == social_configured
            and social_attempt_is_current
        )
    except TypeError:
        return False


def train_asset_prediction(
    ticker: str,
    *,
    force: bool = False,
    include_social: bool = True,
    directory: Path = PREDICTION_DIR,
) -> dict:
    source_ticker = _supported_ticker(ticker)
    safe = sanitize_ticker(source_ticker)
    current = load_prediction(safe, directory=directory)
    data_as_of = market_data_as_of(source_ticker)

    if (
        not force
        and current is not None
        and prediction_is_current(source_ticker, current)
    ):
        return {
            "marketDataAsOf": data_as_of,
            "status": "skipped",
            "ticker": safe,
            "trainedAt": current.get("trainedAt"),
        }

    analysis = analyze_asset(
        source_ticker,
        include_social=include_social,
    )
    trained_at = datetime.now(timezone.utc).isoformat()
    social_enabled = (
        include_social and bool(os.getenv("QWEN_API_KEY", "").strip())
    )
    snapshot = {
        **analysis,
        "schemaVersion": PREDICTION_SCHEMA_VERSION,
        "marketDataAsOf": data_as_of,
        "modelVersion": MODEL_VERSION,
        "socialAttemptedAt": trained_at if social_enabled else None,
        "socialEnabled": social_enabled,
        "trainedAt": trained_at,
        "trainingMode": "daily_backend_job",
    }
    save_prediction(safe, snapshot, directory=directory)

    return {
        "marketDataAsOf": data_as_of,
        "status": "trained",
        "ticker": safe,
        "trainedAt": trained_at,
    }


def refresh_all_predictions(
    *,
    force: bool = False,
    include_social: bool = True,
    directory: Path = PREDICTION_DIR,
) -> dict:
    results: list[dict] = []

    if not _REFRESH_LOCK.acquire(blocking=False):
        return {
            "results": [],
            "status": "already_running",
        }

    try:
        for ticker in LONG_HISTORY_TICKERS:
            try:
                result = train_asset_prediction(
                    ticker,
                    force=force,
                    include_social=include_social,
                    directory=directory,
                )
                results.append(result)
                logger.info(
                    "ML prediction %s for %s using daily data %s",
                    result["status"],
                    result["ticker"],
                    result["marketDataAsOf"],
                )
            except Exception as error:
                logger.exception(
                    "ML prediction refresh failed for %s.",
                    ticker,
                )
                results.append(
                    {
                        "error": str(error),
                        "status": "failed",
                        "ticker": sanitize_ticker(ticker),
                    }
                )
    finally:
        _REFRESH_LOCK.release()

    return {
        "results": results,
        "status": (
            "partial"
            if any(result["status"] == "failed" for result in results)
            else "completed"
        ),
    }


def prediction_status(
    *,
    directory: Path = PREDICTION_DIR,
) -> list[dict]:
    statuses = []

    for ticker in LONG_HISTORY_TICKERS:
        safe = sanitize_ticker(ticker)
        payload = load_prediction(safe, directory=directory)
        statuses.append(
            {
                "available": payload is not None,
                "current": prediction_is_current(ticker, payload),
                "marketDataAsOf": (
                    payload.get("marketDataAsOf") if payload else None
                ),
                "ticker": safe,
                "trainedAt": payload.get("trainedAt") if payload else None,
            }
        )

    return statuses


def select_prediction_horizon(
    payload: dict,
    horizon: str | None,
) -> dict:
    if horizon is None:
        return payload

    normalized_horizon = horizon.upper()
    predictions = [
        prediction
        for prediction in payload.get("predictions", [])
        if prediction.get("horizon") == normalized_horizon
    ]

    if not predictions:
        raise ValueError(
            f"Unsupported horizon '{horizon}'. Expected one of 1D, 1W, 1M"
        )

    return {
        **payload,
        "predictions": predictions,
    }


if __name__ == "__main__":
    print(json.dumps(refresh_all_predictions(), indent=2))
