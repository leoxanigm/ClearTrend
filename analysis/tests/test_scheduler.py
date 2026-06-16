from __future__ import annotations

import os
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pandas as pd

from src.config import normalize_refresh_rate_seconds
from src.market_data.config import intraday_interval_for_refresh_seconds
from src.market_data.history import (
    build_daily_history,
    resolve_intraday_interval,
)
from src.ml.store import refresh_all_predictions
from src.scheduler import refresh_daily_history_if_needed


class DailySchedulerTests(unittest.IsolatedAsyncioTestCase):
    @patch("src.scheduler.asyncio.to_thread", new_callable=AsyncMock)
    @patch("src.scheduler.latest_daily_csv_date")
    async def test_daily_refresh_trains_ml_after_market_data(
        self,
        latest_daily_csv_date_mock,
        to_thread_mock,
    ) -> None:
        latest_daily_csv_date_mock.return_value = (
            datetime.now().date() - timedelta(days=1)
        )

        refreshed = await refresh_daily_history_if_needed()

        self.assertTrue(refreshed)
        self.assertEqual(
            [call.args[0] for call in to_thread_mock.await_args_list],
            [build_daily_history, refresh_all_predictions],
        )

    @patch("src.scheduler.asyncio.to_thread", new_callable=AsyncMock)
    @patch("src.scheduler.latest_daily_csv_date")
    async def test_daily_refresh_does_not_retrain_twice_same_day(
        self,
        latest_daily_csv_date_mock,
        to_thread_mock,
    ) -> None:
        latest_daily_csv_date_mock.return_value = datetime.now().date()

        refreshed = await refresh_daily_history_if_needed()

        self.assertFalse(refreshed)
        to_thread_mock.assert_not_awaited()


class IntradayConfigurationTests(unittest.TestCase):
    def test_admin_frequency_selects_matching_candle_interval(self) -> None:
        self.assertEqual(intraday_interval_for_refresh_seconds(60), "1m")
        self.assertEqual(intraday_interval_for_refresh_seconds(300), "5m")
        self.assertEqual(intraday_interval_for_refresh_seconds(900), "15m")
        self.assertEqual(normalize_refresh_rate_seconds("invalid"), 300)

    def test_transition_uses_freshest_available_interval(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            old_preferred = directory / "AAPL_1m_20260614T100000.csv"
            current_fallback = directory / "AAPL_5m_20260614T100500.csv"
            pd.DataFrame(
                {"Close": range(7)},
                index=pd.date_range(
                    "2026-06-14T10:00:00Z",
                    periods=7,
                    freq="5min",
                ),
            ).to_csv(current_fallback)
            pd.DataFrame(
                {"Close": range(6)},
                index=pd.date_range(
                    "2026-06-14T10:25:00Z",
                    periods=6,
                    freq="1min",
                ),
            ).to_csv(old_preferred)
            os.utime(old_preferred, (100, 100))
            os.utime(current_fallback, (200, 200))

            with patch(
                "src.market_data.history.INTRADAY_DATA_DIR",
                directory,
            ):
                self.assertEqual(resolve_intraday_interval("AAPL", "1m"), "5m")

                os.utime(old_preferred, (300, 300))

                # A newer but partial 1m download must not truncate the chart.
                self.assertEqual(resolve_intraday_interval("AAPL", "1m"), "5m")

                pd.DataFrame(
                    {"Close": range(32)},
                    index=pd.date_range(
                        "2026-06-14T10:00:00Z",
                        periods=32,
                        freq="1min",
                    ),
                ).to_csv(old_preferred)
                os.utime(old_preferred, (400, 400))

                self.assertEqual(resolve_intraday_interval("AAPL", "1m"), "1m")

    def test_complete_coarser_interval_can_replace_finer_cache(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            previous = directory / "AAPL_1m_20260614T100000.csv"
            preferred = directory / "AAPL_5m_20260614T100500.csv"
            pd.DataFrame(
                {"Close": range(31)},
                index=pd.date_range(
                    "2026-06-14T10:00:00Z",
                    periods=31,
                    freq="1min",
                ),
            ).to_csv(previous)
            pd.DataFrame(
                {"Close": range(7)},
                index=pd.date_range(
                    "2026-06-14T10:00:00Z",
                    periods=7,
                    freq="5min",
                ),
            ).to_csv(preferred)
            os.utime(previous, (100, 100))
            os.utime(preferred, (200, 200))

            with patch(
                "src.market_data.history.INTRADAY_DATA_DIR",
                directory,
            ):
                self.assertEqual(resolve_intraday_interval("AAPL", "5m"), "5m")


if __name__ == "__main__":
    unittest.main()
