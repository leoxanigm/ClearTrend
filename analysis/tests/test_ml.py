from __future__ import annotations

import math
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pandas as pd

from src.ml.attention_signal import score_attention_record
from src.ml.historical_regression import analyze_history, analyze_history_frame
from src.ml.reddit_sentiment import _qwen_schema, parse_reddit_feed
from src.ml.prediction_store import (
    MODEL_VERSION,
    load_prediction,
    prediction_is_current,
    save_prediction,
    select_prediction_horizon,
    train_asset_prediction,
)
from src.ml.trend_ensemble import combine_signals


def synthetic_market_frame(rows: int = 900) -> pd.DataFrame:
    rng = np.random.default_rng(42)
    index = pd.bdate_range("2022-01-03", periods=rows)
    drift = 0.0006
    noise = rng.normal(0, 0.009, rows)
    close = 100 * np.exp(np.cumsum(drift + noise))
    open_price = close * (1 + rng.normal(0, 0.002, rows))
    high = np.maximum(open_price, close) * (1 + rng.uniform(0, 0.01, rows))
    low = np.minimum(open_price, close) * (1 - rng.uniform(0, 0.01, rows))

    return pd.DataFrame(
        {
            "Open": open_price,
            "High": high,
            "Low": low,
            "Close": close,
            "Volume": rng.integers(1_000_000, 5_000_000, rows),
        },
        index=index,
    )


class HistoricalRegressionTests(unittest.TestCase):
    def test_returns_price_score_and_chronological_validation(self) -> None:
        result = analyze_history_frame(synthetic_market_frame(), "1W")

        self.assertEqual(result["method"], "ridge_regression")
        self.assertEqual(result["marketCalendar"], "exchange")
        self.assertEqual(result["observationCount"], 5)
        self.assertGreater(result["predictedPrice"], 0)
        self.assertGreaterEqual(result["score"], 0)
        self.assertLessEqual(result["score"], 1)
        self.assertGreater(result["metrics"]["samples"], 500)
        self.assertIsNotNone(result["validationSnapshot"])

    def test_ignores_the_current_incomplete_daily_candle(self) -> None:
        frame = synthetic_market_frame()
        today = pd.Timestamp(datetime.now(timezone.utc).date())
        frame.loc[today] = {
            "Open": 1_000_000,
            "High": 1_500_000,
            "Low": 1,
            "Close": 1_200_000,
            "Volume": 999_999_999,
        }

        result = analyze_history_frame(frame, "1D")

        self.assertNotEqual(result["asOf"], today.date().isoformat())

    @patch(
        "src.ml.historical_regression.load_daily_history",
        return_value=synthetic_market_frame(),
    )
    def test_crypto_horizons_use_calendar_days(self, _) -> None:
        weekly = analyze_history("BTC-USD", "1W")
        monthly = analyze_history("ETH-USD", "1M")

        self.assertEqual(weekly["marketCalendar"], "continuous")
        self.assertEqual(weekly["observationCount"], 7)
        self.assertEqual(monthly["marketCalendar"], "continuous")
        self.assertEqual(monthly["observationCount"], 30)
        self.assertIsNotNone(monthly["validationSnapshot"])


class RedditFeedTests(unittest.TestCase):
    def test_qwen_schema_only_requests_sentiment_measurements(self) -> None:
        schema = _qwen_schema()

        self.assertEqual(
            set(schema["required"]),
            {
                "score",
                "agreement",
                "bullishCount",
                "neutralCount",
                "bearishCount",
            },
        )
        self.assertFalse(
            any(key.startswith("summary") for key in schema["properties"])
        )

    def test_keeps_recent_posts_and_ignores_subreddit_entries(self) -> None:
        payload = b"""<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <id>t5_nvda</id>
            <published>2026-06-08T10:00:00+00:00</published>
            <title>NVDA community</title>
            <link href="https://old.reddit.com/r/nvda/" />
          </entry>
          <entry>
            <id>t3_recent</id>
            <published>2026-06-07T10:00:00+00:00</published>
            <title>Buying NVDA after earnings</title>
            <content>&lt;p&gt;I plan to add shares carefully.&lt;/p&gt;</content>
            <link href="https://old.reddit.com/r/stocks/comments/recent/post/" />
          </entry>
          <entry>
            <id>t3_old</id>
            <published>2026-05-01T10:00:00+00:00</published>
            <title>Old NVDA post</title>
            <link href="https://old.reddit.com/r/stocks/comments/old/post/" />
          </entry>
        </feed>"""
        posts = parse_reddit_feed(
            payload,
            now=datetime(2026, 6, 8, 12, tzinfo=timezone.utc),
        )

        self.assertEqual(len(posts), 1)
        self.assertEqual(posts[0]["id"], "t3_recent")
        self.assertIn("add shares", posts[0]["excerpt"])

    def test_asset_filter_rejects_unrelated_google_url(self) -> None:
        payload = b"""<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <id>t3_form</id>
            <published>2026-06-08T10:00:00+00:00</published>
            <title>Survey for students</title>
            <content>Fill this form at https://docs.google.com/forms/example</content>
            <link href="https://old.reddit.com/r/students/comments/form/post/" />
          </entry>
        </feed>"""
        posts = parse_reddit_feed(
            payload,
            ticker="GOOGL",
            now=datetime(2026, 6, 8, 12, tzinfo=timezone.utc),
        )

        self.assertEqual(posts, [])


class AttentionTests(unittest.TestCase):
    def test_attention_increases_with_meaningful_mentions(self) -> None:
        quiet = score_attention_record(
            {
                "mentions": 2,
                "mentions_24h_ago": 1,
                "rank": 500,
                "rank_24h_ago": 600,
            }
        )
        active = score_attention_record(
            {
                "mentions": 250,
                "mentions_24h_ago": 100,
                "rank": 2,
                "rank_24h_ago": 8,
            }
        )

        self.assertGreater(active["attention"], quiet["attention"])
        self.assertTrue(math.isclose(active["mentionGrowth"], 1.5))


class EnsembleTests(unittest.TestCase):
    def test_attention_changes_sentiment_weight_not_direction(self) -> None:
        historical = {"score": 0.4, "confidence": 0.7}
        sentiment = {
            "available": True,
            "score": 0.8,
            "agreement": 0.9,
            "postCount": 18,
        }
        quiet = combine_signals(
            historical,
            sentiment,
            {"available": True, "attention": 0.05},
            "1D",
        )
        active = combine_signals(
            historical,
            sentiment,
            {"available": True, "attention": 0.95},
            "1D",
        )

        self.assertGreater(active["score"], quiet["score"])
        self.assertEqual(quiet["components"]["attention"], 0.05)
        self.assertGreater(
            active["weights"]["sentiment"],
            quiet["weights"]["sentiment"],
        )


class PredictionStoreTests(unittest.TestCase):
    def test_keeps_one_independent_snapshot_per_asset(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            save_prediction(
                "NVDA",
                {
                    "schemaVersion": 1,
                    "predictions": [{"horizon": "1D", "score": 0.8}],
                    "ticker": "NVDA",
                },
                directory=directory,
            )
            save_prediction(
                "BTC-USD",
                {
                    "schemaVersion": 1,
                    "predictions": [{"horizon": "1D", "score": 0.2}],
                    "ticker": "BTC-USD",
                },
                directory=directory,
            )

            self.assertEqual(
                load_prediction("NVDA", directory=directory)["ticker"],
                "NVDA",
            )
            self.assertEqual(
                load_prediction("BTC-USD", directory=directory)["ticker"],
                "BTC-USD",
            )

    @patch("src.ml.prediction_store.market_data_as_of")
    @patch.dict("os.environ", {"QWEN_API_KEY": "configured"})
    def test_failed_social_attempt_is_not_repeated_the_same_day(
        self,
        market_data_as_of_mock,
    ) -> None:
        today = datetime.now(timezone.utc).isoformat()
        market_data_as_of_mock.return_value = "2026-06-08"
        payload = {
            "marketDataAsOf": "2026-06-08",
            "modelVersion": MODEL_VERSION,
            "predictions": [{"horizon": "1D", "score": 0.5}],
            "schemaVersion": 1,
            "social": {
                "sentiment": {
                    "available": False,
                    "reason": "429 Too Many Requests",
                },
            },
            "socialAttemptedAt": today,
            "socialEnabled": True,
            "trainedAt": today,
        }

        self.assertTrue(prediction_is_current("NVDA", payload))

    @patch("src.ml.prediction_store.market_data_as_of")
    @patch.dict("os.environ", {"QWEN_API_KEY": "configured"})
    def test_missing_social_attempt_is_retried_at_startup(
        self,
        market_data_as_of_mock,
    ) -> None:
        market_data_as_of_mock.return_value = "2026-06-08"
        payload = {
            "marketDataAsOf": "2026-06-08",
            "modelVersion": MODEL_VERSION,
            "predictions": [{"horizon": "1D", "score": 0.5}],
            "schemaVersion": 1,
            "socialEnabled": True,
            "trainedAt": datetime.now(timezone.utc).isoformat(),
        }

        self.assertFalse(prediction_is_current("NVDA", payload))

    @patch("src.ml.prediction_store.prediction_is_current")
    @patch("src.ml.prediction_store.market_data_as_of")
    @patch("src.ml.prediction_store.analyze_asset")
    def test_training_is_skipped_when_daily_snapshot_is_current(
        self,
        analyze_asset_mock,
        market_data_as_of_mock,
        prediction_is_current_mock,
    ) -> None:
        analyze_asset_mock.return_value = {
            "predictions": [{"horizon": "1D", "score": 0.5}],
            "ticker": "NVDA",
        }
        market_data_as_of_mock.return_value = "2026-06-08"
        prediction_is_current_mock.return_value = True

        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            first = train_asset_prediction(
                "NVDA",
                include_social=False,
                directory=directory,
            )
            second = train_asset_prediction(
                "NVDA",
                include_social=False,
                directory=directory,
            )

        self.assertEqual(first["status"], "trained")
        self.assertEqual(second["status"], "skipped")
        analyze_asset_mock.assert_called_once_with(
            "NVDA",
            include_social=False,
        )

    def test_selects_one_cached_horizon_without_retraining(self) -> None:
        payload = {
            "predictions": [
                {"horizon": "1D", "score": 0.4},
                {"horizon": "1W", "score": 0.6},
            ]
        }
        selected = select_prediction_horizon(payload, "1W")

        self.assertEqual(
            selected["predictions"],
            [{"horizon": "1W", "score": 0.6}],
        )


if __name__ == "__main__":
    unittest.main()
