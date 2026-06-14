from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from ..market_data.history import load_daily_history

HORIZON_SESSIONS = {
    "1D": 1,
    "1W": 5,
    "1M": 21,
}
CONTINUOUS_HORIZON_SESSIONS = {
    "1D": 1,
    "1W": 7,
    "1M": 30,
}
CONTINUOUS_MARKET_TICKERS = {
    "BTC-USD",
    "ETH-USD",
}

FEATURE_COLUMNS = [
    "return_1",
    "return_2",
    "return_5",
    "return_10",
    "return_20",
    "close_sma_5",
    "close_sma_10",
    "close_sma_20",
    "close_sma_50",
    "volatility_5",
    "volatility_20",
    "range_pct",
    "volume_change",
    "volume_ratio_20",
    "rsi_14",
]


@dataclass(frozen=True)
class RegressionMetrics:
    directional_accuracy: float
    mae_return: float
    baseline_mae_return: float
    residual_std: float
    samples: int


def _clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def _horizon_sessions(horizon: str, market_calendar: str) -> int:
    calendars = {
        "exchange": HORIZON_SESSIONS,
        "continuous": CONTINUOUS_HORIZON_SESSIONS,
    }

    if market_calendar not in calendars:
        raise ValueError(
            f"Unsupported market calendar '{market_calendar}'. "
            "Expected 'exchange' or 'continuous'"
        )

    return calendars[market_calendar][horizon]


def _market_calendar_for_ticker(ticker: str) -> str:
    return (
        "continuous"
        if ticker.strip().upper() in CONTINUOUS_MARKET_TICKERS
        else "exchange"
    )


def clean_completed_market_frame(frame: pd.DataFrame) -> pd.DataFrame:
    required = ["Open", "High", "Low", "Close", "Volume"]
    missing = [column for column in required if column not in frame.columns]

    if missing:
        raise ValueError(f"Missing market columns: {', '.join(missing)}")

    clean = frame[required].copy().sort_index()
    clean = clean.apply(pd.to_numeric, errors="coerce")
    clean = clean.dropna(subset=["Open", "High", "Low", "Close"])
    clean = clean[clean["Close"] > 0]
    clean["Volume"] = clean["Volume"].fillna(0).clip(lower=0)
    current_utc_date = datetime.now(timezone.utc).date()
    clean = clean.loc[
        [
            pd.Timestamp(index_value).date() < current_utc_date
            for index_value in clean.index
        ]
    ]

    if len(clean) < 180:
        raise ValueError(
            "At least 180 completed daily observations are required"
        )

    return clean


def build_feature_frame(frame: pd.DataFrame) -> pd.DataFrame:
    clean = clean_completed_market_frame(frame)
    close = clean["Close"]
    log_close = np.log(close)
    daily_return = log_close.diff()
    volume = clean["Volume"].replace(0, np.nan)

    features = pd.DataFrame(index=clean.index)

    for period in (1, 2, 5, 10, 20):
        features[f"return_{period}"] = log_close.diff(period)

    for period in (5, 10, 20, 50):
        moving_average = close.rolling(period).mean()
        features[f"close_sma_{period}"] = close / moving_average - 1

    features["volatility_5"] = daily_return.rolling(5).std()
    features["volatility_20"] = daily_return.rolling(20).std()
    features["range_pct"] = (clean["High"] - clean["Low"]) / close
    features["volume_change"] = np.log1p(volume).diff()
    features["volume_ratio_20"] = volume / volume.rolling(20).mean() - 1

    delta = close.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = -delta.clip(upper=0).rolling(14).mean()
    relative_strength = gain / loss.replace(0, np.nan)
    features["rsi_14"] = (100 - 100 / (1 + relative_strength)) / 100

    return features.replace([np.inf, -np.inf], np.nan).fillna(0)


def _target_returns(frame: pd.DataFrame, sessions: int) -> pd.Series:
    close = clean_completed_market_frame(frame)["Close"]

    return np.log(close.shift(-sessions) / close).rename("target")


def _new_model() -> Pipeline:
    return Pipeline(
        [
            ("scale", StandardScaler()),
            ("ridge", Ridge(alpha=100.0)),
        ]
    )


def _cross_validate(
    features: pd.DataFrame,
    target: pd.Series,
) -> RegressionMetrics:
    joined = features.join(target).dropna()
    x = joined[FEATURE_COLUMNS]
    y = joined["target"]
    split_count = min(5, max(2, len(joined) // 180))
    splitter = TimeSeriesSplit(n_splits=split_count)
    actual: list[float] = []
    predicted: list[float] = []

    for train_indices, test_indices in splitter.split(x):
        model = _new_model()
        model.fit(x.iloc[train_indices], y.iloc[train_indices])
        fold_prediction = model.predict(x.iloc[test_indices])
        actual.extend(y.iloc[test_indices].tolist())
        predicted.extend(fold_prediction.tolist())

    actual_array = np.asarray(actual)
    predicted_array = np.asarray(predicted)
    residuals = actual_array - predicted_array
    directional_accuracy = float(
        np.mean(np.sign(actual_array) == np.sign(predicted_array))
    )

    return RegressionMetrics(
        directional_accuracy=directional_accuracy,
        mae_return=float(mean_absolute_error(actual_array, predicted_array)),
        baseline_mae_return=float(np.mean(np.abs(actual_array))),
        residual_std=float(np.std(residuals)),
        samples=len(joined),
    )


def _model_quality(metrics: RegressionMetrics) -> float:
    direction_quality = _clamp(
        (metrics.directional_accuracy - 0.45) / 0.25
    )
    improvement = (
        (metrics.baseline_mae_return - metrics.mae_return)
        / max(metrics.baseline_mae_return, 1e-9)
    )
    improvement_quality = _clamp(improvement / 0.25)

    return 0.75 * direction_quality + 0.25 * improvement_quality


def _validation_snapshot(
    frame: pd.DataFrame,
    features: pd.DataFrame,
    sessions: int,
) -> dict | None:
    clean = clean_completed_market_frame(frame)

    if len(clean) < 240 + sessions:
        return None

    cutoff_position = len(clean) - max(22, sessions + 1)
    cutoff_date = clean.index[cutoff_position]
    target_position = cutoff_position + sessions

    if target_position >= len(clean):
        return None

    target = _target_returns(clean, sessions)
    training = features.join(target).loc[lambda rows: rows.index < cutoff_date]
    training = training.iloc[:-sessions].dropna()

    if len(training) < 180:
        return None

    model = _new_model()
    model.fit(training[FEATURE_COLUMNS], training["target"])
    predicted_return = float(
        model.predict(features.loc[[cutoff_date], FEATURE_COLUMNS])[0]
    )
    start_price = float(clean["Close"].iloc[cutoff_position])
    actual_price = float(clean["Close"].iloc[target_position])
    predicted_price = start_price * math.exp(predicted_return)
    actual_return = math.log(actual_price / start_price)

    return {
        "cutoffDate": pd.Timestamp(cutoff_date).date().isoformat(),
        "targetDate": pd.Timestamp(
            clean.index[target_position]
        ).date().isoformat(),
        "startPrice": round(start_price, 4),
        "predictedPrice": round(predicted_price, 4),
        "actualPrice": round(actual_price, 4),
        "predictedReturn": round(predicted_return, 6),
        "actualReturn": round(actual_return, 6),
        "absolutePriceErrorPercent": round(
            abs(predicted_price - actual_price) / actual_price * 100,
            3,
        ),
        "directionCorrect": bool(
            np.sign(predicted_return) == np.sign(actual_return)
        ),
    }


def analyze_history_frame(
    frame: pd.DataFrame,
    horizon: str,
    *,
    market_calendar: str = "exchange",
) -> dict:
    normalized_horizon = horizon.upper()

    if normalized_horizon not in HORIZON_SESSIONS:
        raise ValueError(
            f"Unsupported horizon '{horizon}'. "
            f"Expected one of {sorted(HORIZON_SESSIONS)}"
        )

    sessions = _horizon_sessions(normalized_horizon, market_calendar)
    clean = clean_completed_market_frame(frame)
    features = build_feature_frame(clean)
    target = _target_returns(clean, sessions)
    dataset = features.join(target).dropna()
    metrics = _cross_validate(features, target)
    model = _new_model()
    model.fit(dataset[FEATURE_COLUMNS], dataset["target"])

    latest_features = features.iloc[[-1]][FEATURE_COLUMNS]
    raw_prediction = float(model.predict(latest_features)[0])
    daily_volatility = float(
        np.log(clean["Close"]).diff().tail(60).std()
    )
    horizon_volatility = max(
        daily_volatility * math.sqrt(sessions),
        0.005 * math.sqrt(sessions),
    )
    predicted_return = float(
        np.clip(raw_prediction, -3 * horizon_volatility, 3 * horizon_volatility)
    )
    current_price = float(clean["Close"].iloc[-1])
    predicted_price = current_price * math.exp(predicted_return)
    score = 0.5 + 0.5 * math.tanh(
        predicted_return / max(2 * horizon_volatility, 1e-9)
    )

    residual_std = max(metrics.residual_std, 0.001)
    lower_price = current_price * math.exp(
        predicted_return - 1.96 * residual_std
    )
    upper_price = current_price * math.exp(
        predicted_return + 1.96 * residual_std
    )
    error_quality = 1 / (
        1 + residual_std / max(horizon_volatility, 1e-9)
    )
    sample_quality = _clamp(metrics.samples / 800)
    confidence = (
        0.6 * _model_quality(metrics) + 0.4 * error_quality
    ) * sample_quality

    return {
        "available": True,
        "method": "ridge_regression",
        "horizon": normalized_horizon,
        "marketCalendar": market_calendar,
        "observationCount": sessions,
        "sessions": sessions,
        "asOf": pd.Timestamp(clean.index[-1]).date().isoformat(),
        "currentPrice": round(current_price, 4),
        "predictedPrice": round(predicted_price, 4),
        "predictedReturn": round(predicted_return, 6),
        "score": round(_clamp(score), 4),
        "confidence": round(_clamp(confidence), 4),
        "priceInterval": {
            "lower": round(lower_price, 4),
            "upper": round(upper_price, 4),
        },
        "metrics": {
            "directionalAccuracy": round(
                metrics.directional_accuracy,
                4,
            ),
            "maeReturn": round(metrics.mae_return, 6),
            "baselineMaeReturn": round(
                metrics.baseline_mae_return,
                6,
            ),
            "residualStd": round(metrics.residual_std, 6),
            "samples": metrics.samples,
        },
        "validationSnapshot": _validation_snapshot(
            clean,
            features,
            sessions,
        ),
    }


def analyze_history(ticker: str, horizon: str) -> dict:
    return analyze_history_frame(
        load_daily_history(ticker),
        horizon,
        market_calendar=_market_calendar_for_ticker(ticker),
    )
