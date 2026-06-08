from __future__ import annotations

from datetime import datetime, timezone

from ..market_data_config import LONG_HISTORY_TICKERS, sanitize_ticker
from .attention_signal import apewisdom_attention
from .historical_regression import HORIZON_SESSIONS, analyze_history
from .reddit_sentiment import reddit_sentiment

SUPPORTED_TICKERS = tuple(LONG_HISTORY_TICKERS)
HORIZON_WEIGHTS = {
    "1D": (0.55, 0.45),
    "1W": (0.65, 0.35),
    "1M": (0.80, 0.20),
}


def _clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def _trend_label(score: float) -> str:
    if score >= 0.57:
        return "bullish"

    if score <= 0.43:
        return "bearish"

    return "neutral"


def _confidence_label(confidence: float) -> str:
    if confidence >= 0.7:
        return "high"

    if confidence >= 0.4:
        return "medium"

    return "low"


def combine_signals(
    historical: dict,
    sentiment: dict,
    attention: dict,
    horizon: str,
) -> dict:
    normalized_horizon = horizon.upper()

    if normalized_horizon not in HORIZON_WEIGHTS:
        raise ValueError(
            f"Unsupported horizon '{horizon}'. "
            f"Expected one of {sorted(HORIZON_WEIGHTS)}"
        )

    history_weight, social_weight = HORIZON_WEIGHTS[normalized_horizon]
    history_score = float(historical["score"])
    history_confidence = float(historical["confidence"])
    attention_level = (
        float(attention.get("attention", 0))
        if attention.get("available")
        else 0.0
    )
    social_available = bool(sentiment.get("available"))

    if social_available:
        sentiment_score = float(sentiment.get("score", 0.5))
        adjusted_social_weight = social_weight * (
            0.35 + 0.65 * attention_level
        )
        total_weight = history_weight + adjusted_social_weight
        score = (
            history_weight * history_score
            + adjusted_social_weight * sentiment_score
        ) / total_weight
        agreement = 1 - min(abs(history_score - sentiment_score) * 2, 1)
        post_count = max(0, int(sentiment.get("postCount", 0)))
        sample_quality = min(post_count / 15, 1)
        social_quality = (
            float(sentiment.get("agreement", 0))
            * sample_quality
            * (0.3 + 0.7 * attention_level)
        )
        base_confidence = (
            history_weight * history_confidence
            + adjusted_social_weight * social_quality
        ) / total_weight
        confidence = base_confidence * (0.55 + 0.45 * agreement)
    else:
        sentiment_score = None
        adjusted_social_weight = 0.0
        agreement = None
        score = history_score
        confidence = history_confidence * 0.8

    score = _clamp(score)
    confidence = _clamp(confidence, maximum=0.95)

    return {
        "score": round(score, 4),
        "trend": _trend_label(score),
        "confidence": round(confidence, 4),
        "confidenceLevel": _confidence_label(confidence),
        "weights": {
            "historical": round(history_weight, 4),
            "sentiment": round(adjusted_social_weight, 4),
        },
        "signalAgreement": (
            round(agreement, 4) if agreement is not None else None
        ),
        "components": {
            "historical": round(history_score, 4),
            "sentiment": (
                round(sentiment_score, 4)
                if sentiment_score is not None
                else None
            ),
            "attention": round(attention_level, 4),
        },
    }


def analyze_asset(
    ticker: str,
    *,
    horizon: str | None = None,
    include_social: bool = True,
) -> dict:
    safe = sanitize_ticker(ticker)
    supported_by_safe = {
        sanitize_ticker(item): item
        for item in SUPPORTED_TICKERS
    }

    if safe not in supported_by_safe:
        raise ValueError(
            f"Ticker '{ticker}' is not part of the ML asset universe"
        )

    source_ticker = supported_by_safe[safe]
    horizons = [horizon.upper()] if horizon else list(HORIZON_SESSIONS)

    for selected_horizon in horizons:
        if selected_horizon not in HORIZON_SESSIONS:
            raise ValueError(
                f"Unsupported horizon '{selected_horizon}'. "
                f"Expected one of {sorted(HORIZON_SESSIONS)}"
            )

    if include_social:
        sentiment = reddit_sentiment(source_ticker)
        attention = apewisdom_attention(source_ticker)
    else:
        sentiment = {
            "available": False,
            "reason": "Social analysis was disabled",
            "postCount": 0,
        }
        attention = {
            "available": False,
            "reason": "Social analysis was disabled",
            "attention": 0.0,
            "mentions": 0,
        }

    predictions = []

    for selected_horizon in horizons:
        historical = analyze_history(source_ticker, selected_horizon)
        fusion = combine_signals(
            historical,
            sentiment,
            attention,
            selected_horizon,
        )
        predictions.append(
            {
                "horizon": selected_horizon,
                **fusion,
                "estimatedPrice": historical["predictedPrice"],
                "estimatedReturn": historical["predictedReturn"],
                "priceInterval": historical["priceInterval"],
                "historical": historical,
            }
        )

    return {
        "ticker": safe,
        "sourceTicker": source_ticker,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "predictions": predictions,
        "social": {
            "sentiment": sentiment,
            "attention": attention,
        },
        "disclaimer": (
            "Experimental trend estimate for educational use; "
            "not financial advice."
        ),
    }
