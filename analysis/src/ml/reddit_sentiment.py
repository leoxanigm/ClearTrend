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

REDDIT_SEARCH_URL = "https://old.reddit.com/search.rss"
REDDIT_USER_AGENT = "ClearTrend academic project/1.0"
GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "{model}:generateContent"
)
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite"
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
    "GOOGL": '"GOOGL" OR "Alphabet stock"',
    "NVDA": '"NVDA" OR "Nvidia stock"',
}

ASSET_MATCH_TERMS = {
    "GSPC": ("s&p 500", "sp500", "spy"),
    "IXIC": ("nasdaq composite", "qqq"),
    "BTC-USD": ("bitcoin", "btc"),
    "ETH-USD": ("ethereum", "ether", "eth"),
    "GC=F": ("gold", "xau", "gld"),
    "GOOGL": ("googl", "alphabet stock", "google stock"),
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


def _safe_ticker(ticker: str) -> str:
    return ticker.replace("^", "").upper()


def _query_for_ticker(ticker: str) -> str:
    safe = _safe_ticker(ticker)

    return ASSET_SEARCH_QUERIES.get(safe, safe)


def _matches_asset(ticker: str, title: str, excerpt: str) -> bool:
    safe = _safe_ticker(ticker)
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
    response = requests.get(
        REDDIT_SEARCH_URL,
        params={
            "limit": "100",
            "q": _query_for_ticker(ticker),
            "sort": "new",
            "t": "week",
            "type": "link",
        },
        headers={"User-Agent": REDDIT_USER_AGENT},
        timeout=timeout,
    )
    response.raise_for_status()

    return parse_reddit_feed(
        response.content,
        ticker=ticker,
        days=days,
        max_posts=max_posts,
    )


def _gemini_schema() -> dict[str, Any]:
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


def _clamp(value: object) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.5

    return max(0.0, min(1.0, number))


def _analyze_with_gemini(
    ticker: str,
    posts: list[dict],
    *,
    timeout: float = 45,
) -> dict:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()

    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    model = os.getenv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL).strip()
    post_lines = []

    for index, post in enumerate(posts, start=1):
        post_lines.append(
            f"{index}. {post['title']}\n"
            f"   {post['excerpt'][:MAX_EXCERPT_CHARS]}"
        )

    prompt = (
        "You classify current retail-market sentiment. Analyze only the "
        f"following Reddit posts about {_safe_ticker(ticker)} from the last "
        "seven days. Ignore jokes, spam, unrelated uses of the ticker and "
        "unsupported certainty. Determine whether authors mostly express an "
        "intention to invest/buy, wait, or withdraw/sell. Do not provide "
        "financial advice or summarize the posts. Return only the structured "
        "sentiment measurements requested by the JSON schema.\n\nPosts:\n"
        + "\n".join(post_lines)
    )
    response = requests.post(
        GEMINI_API_URL.format(model=model),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseJsonSchema": _gemini_schema(),
                "temperature": 0.1,
            },
        },
        timeout=timeout,
    )
    response.raise_for_status()
    payload = response.json()

    try:
        text = payload["candidates"][0]["content"]["parts"][0]["text"]
        result = json.loads(text)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as error:
        raise ValueError("Gemini returned an invalid sentiment response") from error

    return {
        "score": round(_clamp(result.get("score")), 4),
        "agreement": round(_clamp(result.get("agreement")), 4),
        "bullishCount": max(0, int(result.get("bullishCount", 0))),
        "neutralCount": max(0, int(result.get("neutralCount", 0))),
        "bearishCount": max(0, int(result.get("bearishCount", 0))),
        "model": model,
    }


def reddit_sentiment(ticker: str) -> dict:
    cache_key = _safe_ticker(ticker)
    cached = _CACHE.get(cache_key)

    if cached and cached[0] > time.monotonic():
        return cached[1]

    if not os.getenv("GEMINI_API_KEY", "").strip():
        return {
            "available": False,
            "reason": "GEMINI_API_KEY is not configured",
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
            analysis = _analyze_with_gemini(ticker, posts)
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

    _CACHE[cache_key] = (time.monotonic() + CACHE_SECONDS, result)

    return result
