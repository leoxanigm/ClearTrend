from __future__ import annotations

import unittest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch

from src.market_data_history import build_daily_history
from src.ml.prediction_store import refresh_all_predictions
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


if __name__ == "__main__":
    unittest.main()
