from __future__ import annotations

import math
import time

import requests

from ..market_data.config import sanitize_ticker
from .utils import clamp

APEWISDOM_API_URL = "https://apewisdom.io/api/v1.0/filter/all/page"
CACHE_SECONDS = 15 * 60
MAX_PAGES = 15

APEWISDOM_TICKERS = {
    "GSPC": "SPY",
    "IXIC": "QQQ",
    "BTC-USD": "BTC.X",
    "ETH-USD": "ETH.X",
    "GC=F": "GLD",
    "GOOGL": "GOOGL",
    "NVDA": "NVDA",
}

_CACHE: dict[str, tuple[float, dict]] = {}



def score_attention_record(record: dict) -> dict:
    mentions = max(0, int(record.get("mentions", 0)))
    previous_mentions = max(0, int(record.get("mentions_24h_ago", 0)))
    rank = max(1, int(record.get("rank", 9999)))
    previous_rank = max(1, int(record.get("rank_24h_ago", rank)))
    mention_level = 1 - math.exp(-mentions / 60)
    rank_level = 1 / (1 + math.log1p(rank) / 3)
    attention = clamp(0.75 * mention_level + 0.25 * rank_level)

    if previous_mentions == 0:
        growth = 1.0 if mentions > 0 else 0.0
    else:
        growth = (mentions - previous_mentions) / previous_mentions

    return {
        "available": True,
        "source": "apewisdom",
        "attention": round(attention, 4),
        "mentions": mentions,
        "mentions24hAgo": previous_mentions,
        "mentionGrowth": round(growth, 4),
        "rank": rank,
        "rank24hAgo": previous_rank,
    }


def apewisdom_attention(ticker: str, timeout: float = 12) -> dict:
    safe = sanitize_ticker(ticker)
    target = APEWISDOM_TICKERS.get(safe, safe)
    cached = _CACHE.get(target)

    if cached and cached[0] > time.monotonic():
        return cached[1]

    try:
        page = 1

        while page <= MAX_PAGES:
            response = requests.get(
                f"{APEWISDOM_API_URL}/{page}",
                timeout=timeout,
            )
            response.raise_for_status()
            payload = response.json()

            for item in payload.get("results", []):
                if str(item.get("ticker", "")).upper() == target:
                    result = score_attention_record(item)
                    result["matchedTicker"] = target
                    _CACHE[target] = (
                        time.monotonic() + CACHE_SECONDS,
                        result,
                    )
                    return result

            total_pages = min(
                MAX_PAGES,
                max(1, int(payload.get("pages", page))),
            )

            if page >= total_pages:
                break

            page += 1

        result = {
            "available": False,
            "reason": f"{target} was not found on ApeWisdom",
            "matchedTicker": target,
            "attention": 0.0,
            "mentions": 0,
        }
    except (requests.RequestException, TypeError, ValueError) as error:
        result = {
            "available": False,
            "reason": str(error),
            "matchedTicker": target,
            "attention": 0.0,
            "mentions": 0,
        }

    _CACHE[target] = (time.monotonic() + CACHE_SECONDS, result)

    return result
