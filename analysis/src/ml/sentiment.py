from __future__ import annotations

import html
import json
import os
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from typing import Any

import requests

from ..market_data.config import sanitize_ticker
from .utils import safe_clamp

REDDIT_SEARCH_URL = "https://old.reddit.com/search.rss"
REDDIT_USER_AGENT = "ClearTrend academic project/1.0"
QWEN_API_URL = "https://kss-api.mbinc.tech/api/chat"
DEFAULT_QWEN_MODEL = "gemma3:1b"
MAX_POSTS = 50
MAX_TITLE_CHARS = 180
MAX_EXCERPT_CHARS = 360
CACHE_SECONDS = 30 * 60

ASSET_SEARCH_QUERIES = {
    "GSPC": '"S&P 500" OR "SPY stock"',
    "IXIC": '"Nasdaq Composite" OR "QQQ ETF"',
    "BTC-USD": '"Bitcoin" OR "BTC crypto"',
    "ETH-USD": '"Ethereum" OR "ETH crypto"',
    "GC=F": '"gold price" OR "GLD ETF"',
    "GOOGL": '"GOOGL" OR "Alphabet stock" OR "Google stock" OR "Alphabet Inc"',
    "NVDA": '"NVDA" OR "Nvidia stock"',
}

ASSET_MATCH_TERMS = {
    "GSPC": ("s&p 500", "sp500", "spy"),
    "IXIC": ("nasdaq composite", "qqq"),
    "BTC-USD": ("bitcoin", "btc"),
    "ETH-USD": ("ethereum", "ether", "eth"),
    "GC=F": ("gold", "xau", "gld"),
    "GOOGL": ("googl", "alphabet stock", "google stock", "alphabet inc", "google"),
    "NVDA": ("nvda", "nvidia"),
}

MARKET_CONTEXT_TERMS = (
    "buy",
    "sell",
    "price",
    "stock",
    "share",
    "invest",
    "market",
    "bull",
    "bear",
    "call",
    "put",
    "earnings",
    "portfolio",
    "trade",
    "trading",
    "etf",
    "hold",
    "long",
    "short",
    "dip",
    "rally",
    "crash",
    "valuation",
    "forecast",
    "prediction",
    "target",
    "inflow",
    "outflow",
    "support",
    "resistance",
)

IRRELEVANT_CONTEXT_TERMS = (
    "discord bot",
    "frontend engineer",
    "hiring",
    "jewelry",
    "necklace",
    "payment method",
    "ring",
    "rose gold",
    "seed phrase",
    "vps",
    "wallet",
    "watch qc",
)

_CACHE: dict[str, tuple[float, dict]] = {}
_LAST_REDDIT_REQUEST: float = 0.0
_REDDIT_MIN_INTERVAL: float = 8.0  # seconds between consecutive Reddit requests


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        value = data.strip()

        if value:
            self.parts.append(value)


def _strip_html(value: str) -> str:
    parser = _TextExtractor()
    parser.feed(value)

    return " ".join(html.unescape(" ".join(parser.parts)).split())


def _query_for_ticker(ticker: str) -> str:
    safe = sanitize_ticker(ticker)

    return ASSET_SEARCH_QUERIES.get(safe, safe)


def _matches_asset(ticker: str, title: str, excerpt: str) -> bool:
    safe = sanitize_ticker(ticker)
    terms = ASSET_MATCH_TERMS.get(safe, (safe,))
    text = re.sub(r"https?://\S+", " ", f"{title} {excerpt}".lower())
    has_asset = any(
        re.search(rf"(?<![a-z0-9]){re.escape(term)}(?![a-z0-9])", text)
        for term in terms
    )
    has_market_context = any(term in text for term in MARKET_CONTEXT_TERMS)
    has_irrelevant_context = any(
        term in text
        for term in IRRELEVANT_CONTEXT_TERMS
    )

    return has_asset and has_market_context and not has_irrelevant_context


def parse_reddit_feed(
    xml_payload: bytes,
    *,
    ticker: str | None = None,
    now: datetime | None = None,
    days: int = 7,
    max_posts: int = MAX_POSTS,
) -> list[dict]:
    reference_time = now or datetime.now(timezone.utc)
    cutoff = reference_time - timedelta(days=days)
    root = ET.fromstring(xml_payload)
    namespace = {"atom": "http://www.w3.org/2005/Atom"}
    posts: list[dict] = []
    seen_ids: set[str] = set()
    seen_titles: set[str] = set()

    for entry in root.findall("atom:entry", namespace):
        post_id = entry.findtext("atom:id", default="", namespaces=namespace)

        if not post_id.startswith("t3_") or post_id in seen_ids:
            continue

        published_raw = entry.findtext(
            "atom:published",
            default="",
            namespaces=namespace,
        )

        try:
            published_at = datetime.fromisoformat(
                published_raw.replace("Z", "+00:00")
            )
        except ValueError:
            continue

        if published_at < cutoff:
            continue

        link_node = entry.find("atom:link", namespace)
        url = link_node.attrib.get("href", "") if link_node is not None else ""

        if "/comments/" not in url:
            continue

        title = _strip_html(
            entry.findtext(
                "atom:title",
                default="",
                namespaces=namespace,
            )
        )[:MAX_TITLE_CHARS]
        excerpt = _strip_html(
            entry.findtext(
                "atom:content",
                default="",
                namespaces=namespace,
            )
        )[:MAX_EXCERPT_CHARS]

        if not title:
            continue

        if ticker and not _matches_asset(ticker, title, excerpt):
            continue

        normalized_title = re.sub(r"\W+", " ", title.lower()).strip()

        if normalized_title in seen_titles:
            continue

        seen_ids.add(post_id)
        seen_titles.add(normalized_title)
        posts.append(
            {
                "id": post_id,
                "title": title,
                "excerpt": excerpt,
                "publishedAt": published_at.isoformat(),
                "url": url,
            }
        )

        if len(posts) >= max_posts:
            break

    return posts


def fetch_reddit_posts(
    ticker: str,
    *,
    days: int = 7,
    max_posts: int = MAX_POSTS,
    timeout: float = 15,
) -> list[dict]:
    global _LAST_REDDIT_REQUEST
    elapsed = time.monotonic() - _LAST_REDDIT_REQUEST
    if elapsed < _REDDIT_MIN_INTERVAL:
        time.sleep(_REDDIT_MIN_INTERVAL - elapsed)

    params = {
        "limit": "100",
        "q": _query_for_ticker(ticker),
        "sort": "new",
        "t": "week",
        "type": "link",
    }
    headers = {"User-Agent": REDDIT_USER_AGENT}
    last_exc: Exception | None = None

    for delay in [0, 10, 30]:
        if delay:
            time.sleep(delay)
        try:
            _LAST_REDDIT_REQUEST = time.monotonic()
            response = requests.get(
                REDDIT_SEARCH_URL,
                params=params,
                headers=headers,
                timeout=timeout,
            )
            response.raise_for_status()
            return parse_reddit_feed(
                response.content,
                ticker=ticker,
                days=days,
                max_posts=max_posts,
            )
        except requests.HTTPError as exc:
            if exc.response is not None and exc.response.status_code == 429:
                last_exc = exc
                continue
            raise
    raise last_exc  # type: ignore[misc]


def _qwen_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "score": {
                "type": "number",
                "description": (
                    "0 means strongly bearish or withdrawing money, "
                    "0.5 neutral, 1 strongly bullish or investing."
                ),
            },
            "agreement": {
                "type": "number",
                "description": (
                    "Agreement between posts from 0 for divided to 1 for "
                    "consistent."
                ),
            },
            "bullishCount": {"type": "integer"},
            "neutralCount": {"type": "integer"},
            "bearishCount": {"type": "integer"},
        },
        "required": [
            "score",
            "agreement",
            "bullishCount",
            "neutralCount",
            "bearishCount",
        ],
    }



def _analyze_with_qwen(
    ticker: str,
    posts: list[dict],
    *,
    timeout: float = 200,
) -> dict:
    api_key = os.getenv("QWEN_API_KEY", "").strip()

    if not api_key:
        raise RuntimeError("QWEN_API_KEY is not configured")

    model = os.getenv("QWEN_MODEL", DEFAULT_QWEN_MODEL).strip()
    post_lines = []

    for index, post in enumerate(posts[:10], start=1):
        post_lines.append(
            f"{index}. {post['title']}\n"
            f"   {post['excerpt'][:MAX_EXCERPT_CHARS]}"
        )

    # OMG it's fricking slow, I'll have to optimize that...
    safe = sanitize_ticker(ticker)
    prompt = (
        f"Analyze these {len(post_lines)} Reddit posts about {safe} "
        "from the past 7 days and fill in the JSON fields:\n"
        "- score: float 0.0 (strongly bearish/selling) to 1.0 (strongly bullish/buying), 0.5 = neutral\n"
        "- agreement: float 0.0 (divided opinions) to 1.0 (everyone agrees)\n"
        "- bullishCount: number of bullish posts\n"
        "- neutralCount: number of neutral posts\n"
        "- bearishCount: number of bearish posts\n\n"
        "Posts:\n" + "\n".join(post_lines)
    )
    body = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": True,
        "format": _qwen_schema(),
        "think": False,
        "options": {"temperature": 0.1, "think": False},
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    last_error: Exception | None = None
    for _attempt in range(3):
        try:
            response = requests.post(
                QWEN_API_URL,
                headers=headers,
                json=body,
                stream=True,
                timeout=timeout,
            )
            response.raise_for_status()
            content = ""
            for line in response.iter_lines():
                if not line:
                    continue
                chunk = json.loads(line)
                content += chunk.get("message", {}).get("content", "")
                if chunk.get("done"):
                    break
            result = json.loads(content)
            break
        except requests.HTTPError as exc:
            if exc.response is not None and exc.response.status_code == 524:
                # 524 = Cloudflare gateway timeout; the model is still running, retry.
                last_error = exc
                time.sleep(5)
            else:
                raise
        except (requests.Timeout, json.JSONDecodeError) as exc:
            last_error = exc
            time.sleep(5)
    else:
        raise RuntimeError(f"Qwen API failed after 3 attempts: {last_error}")

    return {
        "score": round(safe_clamp(result.get("score")), 4),
        "agreement": round(safe_clamp(result.get("agreement")), 4),
        "bullishCount": max(0, int(result.get("bullishCount", 0))),
        "neutralCount": max(0, int(result.get("neutralCount", 0))),
        "bearishCount": max(0, int(result.get("bearishCount", 0))),
        "model": model,
    }


def reddit_sentiment(ticker: str) -> dict:
    cache_key = sanitize_ticker(ticker)
    cached = _CACHE.get(cache_key)

    if cached and cached[0] > time.monotonic():
        return cached[1]

    if not os.getenv("QWEN_API_KEY", "").strip():
        return {
            "available": False,
            "reason": "QWEN_API_KEY is not configured",
            "postCount": 0,
        }

    posts: list[dict] = []

    try:
        posts = fetch_reddit_posts(ticker)

        if not posts:
            result = {
                "available": False,
                "reason": "No recent Reddit posts were found",
                "postCount": 0,
            }
        else:
            analysis = _analyze_with_qwen(ticker, posts)
            result = {
                "available": True,
                "source": "reddit_rss",
                "periodDays": 7,
                "postCount": len(posts),
                **analysis,
            }
    except (
        ET.ParseError,
        requests.RequestException,
        RuntimeError,
        ValueError,
    ) as error:
        result = {
            "available": False,
            "collectedPostCount": len(posts),
            "reason": str(error),
            "postCount": 0,
        }
        # Managing potential rate limit from reddit
        is_429 = (
            isinstance(error, requests.HTTPError)
            and error.response is not None
            and error.response.status_code == 429
        )
        ttl = 60 if is_429 else CACHE_SECONDS
        _CACHE[cache_key] = (time.monotonic() + ttl, result)
        return result

    _CACHE[cache_key] = (time.monotonic() + CACHE_SECONDS, result)

    return result
