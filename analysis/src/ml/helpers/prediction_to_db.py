from __future__ import annotations

import os
import logging
from datetime import datetime, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from uuid import uuid4
import psycopg
from psycopg.types.json import Jsonb

from ...market_data_config import sanitize_ticker

logger = logging.getLogger(__name__)

ML_ANALYSIS_USER_EMAIL = "ml_analysis@cleartrend.com"
ML_ANALYSIS_USER_NAME = "ml_analysis_job"

def _database_url() -> str | None:
    value = os.getenv("DATABASE_URL")

    if not value:
        return None

    parts = urlsplit(value)
    query = urlencode(
        [
            (key, query_value)
            for key, query_value in parse_qsl(parts.query, keep_blank_values=True)
            if key != "schema"
        ]
    )

    return urlunsplit((parts.scheme, parts.netloc, parts.path, query, parts.fragment))


def _parse_timestamp(value: object) -> datetime:
    if isinstance(value, datetime):
        return value

    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return datetime.now(timezone.utc)


def _trend_label(value: object) -> str | None:
    normalized = str(value or "").strip().upper()

    if normalized in {"BULLISH", "NEUTRAL", "BEARISH"}:
        return normalized

    return None


def _recommendation_label(trend: str | None, confidence: float | None) -> str:
    if confidence is not None and confidence < 0.35:
        return "WATCH"

    if trend == "BULLISH":
        return "BUY"

    if trend == "BEARISH":
        return "SELL"

    return "HOLD"


def _optional_float(value: object) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _ensure_ml_analysis_user(cur) -> str:
    email = os.getenv("ML_ANALYSIS_USER_EMAIL", ML_ANALYSIS_USER_EMAIL).strip()
    display_name = os.getenv(
        "ML_ANALYSIS_USER_NAME",
        ML_ANALYSIS_USER_NAME,
    ).strip()

    cur.execute(
        """
        SELECT id
        FROM users
        WHERE email = %s
        ORDER BY "createdAt" ASC
        LIMIT 1
        """,
        (email,),
    )
    row = cur.fetchone()

    if row:
        return row[0]

    user_id = str(uuid4())
    now = datetime.now(timezone.utc)

    cur.execute(
        """
        INSERT INTO users (
            id,
            email,
            "displayName",
            role,
            "createdAt",
            "updatedAt"
        )
        VALUES (%s, %s, %s, 'ANALYST', %s, %s)
        """,
        (user_id, email, display_name, now, now),
    )

    return user_id


def _ensure_asset(cur, symbol: str) -> str:
    cur.execute(
        """
        SELECT id
        FROM assets
        WHERE symbol = %s
        LIMIT 1
        """,
        (symbol,),
    )
    row = cur.fetchone()

    if row:
        return row[0]

    asset_id = str(uuid4())
    now = datetime.now(timezone.utc)

    cur.execute(
        """
        INSERT INTO assets (
            id,
            symbol,
            name,
            "createdAt",
            "updatedAt"
        )
        VALUES (%s, %s, %s, %s, %s)
        """,
        (asset_id, symbol, symbol, now, now),
    )

    return asset_id

def save_prediction_to_database(payload: dict) -> None:
    database_url = _database_url()

    if not database_url:
        logger.info("Skipping ML prediction database sync: DATABASE_URL is not set.")
        return

    predictions = payload.get("predictions")

    if not isinstance(predictions, list):
        logger.warning("Skipping ML prediction database sync: invalid predictions payload.")
        return

    symbol = sanitize_ticker(str(payload.get("ticker") or ""))

    if not symbol:
        logger.warning("Skipping ML prediction database sync: missing ticker.")
        return

    trained_at = _parse_timestamp(payload.get("trainedAt"))
    social = payload.get("social") if isinstance(payload.get("social"), dict) else {}
    sentiment = (
        social.get("sentiment")
        if isinstance(social.get("sentiment"), dict)
        else {}
    )
    sentiment_score = _optional_float(sentiment.get("score"))

    try:
        with psycopg.connect(database_url, connect_timeout=5) as conn:
            with conn.cursor() as cur:
                user_id = _ensure_ml_analysis_user(cur)
                asset_id = _ensure_asset(cur, symbol)

                for prediction in predictions:
                    if not isinstance(prediction, dict):
                        continue

                    horizon = str(prediction.get("horizon") or "").strip().upper()

                    if horizon not in {"1D", "1W", "1M"}:
                        continue

                    trend = _trend_label(prediction.get("trend"))
                    confidence = _optional_float(prediction.get("confidence"))
                    score = _optional_float(prediction.get("score"))
                    estimated_return = _optional_float(
                        prediction.get("estimatedReturn")
                    )
                    recommendation = _recommendation_label(trend, confidence)

                    summary = (
                        f"{symbol} {horizon} ML prediction is "
                        f"{str(prediction.get('trend') or 'neutral').lower()} "
                        f"with {confidence:.0%} confidence."
                        if confidence is not None
                        else f"{symbol} {horizon} ML prediction is available."
                    )

                    if estimated_return is not None:
                        summary += (
                            f" Estimated return: {estimated_return * 100:.2f}%."
                        )

                    # Keep one current ML analysis row per system user, asset, and horizon.
                    cur.execute(
                        """
                        DELETE FROM analyses
                        WHERE "userId" = %s
                          AND "assetId" = %s
                          AND horizon = %s
                        """,
                        (user_id, asset_id, horizon),
                    )

                    analysis_id = str(uuid4())

                    cur.execute(
                        """
                        INSERT INTO analyses (
                            id,
                            "userId",
                            "assetId",
                            status,
                            horizon,
                            "trendLabel",
                            recommendation,
                            "technicalScore",
                            "emotionScore",
                            "confidenceScore",
                            summary,
                            "startedAt",
                            "completedAt",
                            "createdAt",
                            "updatedAt"
                        )
                        VALUES (%s, %s, %s, 'SUCCEEDED', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s )
                        """,
                        (
                            analysis_id, user_id, asset_id, horizon, trend, recommendation, score, sentiment_score,
                            confidence, summary, trained_at, trained_at, trained_at, datetime.now(timezone.utc),
                        ),
                    )

                    cur.execute(
                        """
                        INSERT INTO analysis_sources (
                            id,
                            "analysisId",
                            kind,
                            title,
                            excerpt,
                            "rawPayload",
                            "createdAt"
                        )
                        VALUES (%s, %s, 'API', %s, %s, %s, %s)
                        """,
                        (
                            str(uuid4()),
                            analysis_id,
                            "ML prediction snapshot",
                            (
                                f"Model {payload.get('modelVersion')} using "
                                f"market data as of {payload.get('marketDataAsOf')}."
                            ),
                            Jsonb(
                                {
                                    "prediction": prediction,
                                    "social": social,
                                    "modelVersion": payload.get("modelVersion"),
                                    "marketDataAsOf": payload.get("marketDataAsOf"),
                                    "trainedAt": payload.get("trainedAt"),
                                    "trainingMode": payload.get("trainingMode"),
                                }
                            ),
                            datetime.now(timezone.utc),
                        ),
                    )

            conn.commit()

        logger.info("Synced ML prediction for %s to analyses table.", symbol)
    except Exception:
        logger.exception("Failed to sync ML prediction for %s to database.", symbol)