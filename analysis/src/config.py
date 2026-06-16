import logging
import os
from datetime import timedelta
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import psycopg

from .market_data.config import (
    DEFAULT_INTRADAY_REFRESH_SECONDS,
    INTRADAY_INTERVAL_BY_REFRESH_SECONDS,
)

logger = logging.getLogger(__name__)

FINANCE_REFRESH_RATE_SETTING_KEY = "financeRefreshRateSeconds"
ALLOWED_REFRESH_RATE_SECONDS = set(INTRADAY_INTERVAL_BY_REFRESH_SECONDS)


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


def normalize_refresh_rate_seconds(value: object) -> int:
    try:
        seconds = int(str(value))
    except (TypeError, ValueError):
        return DEFAULT_INTRADAY_REFRESH_SECONDS

    if seconds in ALLOWED_REFRESH_RATE_SECONDS:
        return seconds

    return DEFAULT_INTRADAY_REFRESH_SECONDS


def get_finance_refresh_rate_duration() -> timedelta:
    database_url = _database_url()

    if not database_url:
        return timedelta(seconds=DEFAULT_INTRADAY_REFRESH_SECONDS)

    try:
        with psycopg.connect(database_url, connect_timeout=2) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT value
                    FROM app_settings
                    WHERE key = %s
                    LIMIT 1
                    """,
                    (FINANCE_REFRESH_RATE_SETTING_KEY,),
                )
                row = cur.fetchone()
    except Exception:
        logger.exception("Failed to read finance refresh rate setting.")
        return timedelta(seconds=DEFAULT_INTRADAY_REFRESH_SECONDS)

    return timedelta(seconds=normalize_refresh_rate_seconds(row[0] if row else None))
