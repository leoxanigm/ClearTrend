# Market Data Flow

Mini-reference for how market data is fetched, stored, refreshed, and used by
the dashboard.

## Source

- Market data comes from the local FastAPI `analysis` service.
- `analysis` uses the `yfinance` Python package to download Yahoo Finance data.
- The frontend uses `analysis` for the active watchlist, search, and dashboard
  chart paths.
- There is currently no provider fallback: if `analysis` cannot serve a ticker,
  the frontend treats the data as unavailable.

## Storage

Data is stored as CSV files under `analysis/data` inside the service container.
In Docker production this path is persisted by the `analysis_data` volume; in
dev it is bind-mounted through `./analysis:/app`.

- `analysis/data/history`
  - Daily candles.
  - S&P 500 assets use `1y` history.
  - `^GSPC`, `^IXIC`, `BTC-USD`, `ETH-USD`, `GOOGL`, and `NVDA` use `5y`
    history for longer AI/trend studies.

- `analysis/data/intraday`
  - Short intraday candles for `1D`.
  - Yahoo period/interval: `1d / 5m`.

- `analysis/data/weekly_intraday`
  - Persisted hourly candles for `1W`.
  - Yahoo base period/interval: `30d / 1h`.
  - The dashboard only displays the latest 7 days.
  - `_yfinance_refresh.txt` records when the Yahoo `1W` base cache was last
    rebuilt.

Each ticker/interval keeps only one current CSV snapshot. New snapshots replace
older ones for the same ticker and interval.

## Implementation Layout

- `market_data.py`
  - Public facade used by `main.py`, `scheduler.py`, and `database_builder.py`.
- `market_data_config.py`
  - Constants, paths, periods, 5 year ticker list, and ticker normalization.
- `market_data_storage.py`
  - CSV read/write helpers, cache timestamps, and refresh markers.
- `market_data_fetcher.py`
  - Yahoo/yfinance downloads and S&P 500 ticker discovery.
- `market_data_history.py`
  - Daily, intraday, and 1W refresh logic; 1D-to-1W merge; official daily close
    correction.
- `market_data_views.py`
  - API payload shaping for `/candles`, `/history/{ticker}/latest`, and
    `updatedAt`.

## Refresh

Docker startup runs:

```bash
python -m src.database_builder
```

That warms missing or stale caches before `uvicorn` starts. Then the FastAPI
lifespan starts `run_market_data_scheduler()` in the background.

Current cadence:

| Dataset | Yahoo query | Refresh rule | Used by |
| --- | --- | --- | --- |
| Daily | `1d` candles, `1y` or `5y` period | Once per calendar day, or if missing | `1M`, `3M`, `1Y`, watchlist latest |
| 1D intraday | `period=1d`, `interval=5m` | Global scheduler every hour; active ticker on-demand when older than 5 minutes | `1D`, latest daily overlay |
| 1W hourly | `period=30d`, `interval=1h` | Base yfinance cache once per day, then hourly merge from `1D` | `1W` |

The hourly merge works like this:

1. Refresh `1D` candles from Yahoo.
2. Aggregate the new 5 minute candles into 1 hour candles.
3. Merge those hourly candles into `analysis/data/weekly_intraday`.
4. Save the merged file, keeping the latest 30 days in cache.

This means `1W` keeps the hourly values on disk instead of only displaying a
temporary overlay.

When the dashboard asks for `/candles` or `/candles/{ticker}/meta`, `analysis`
checks the active ticker's `1D` cache. If that ticker cache is older than 5
minutes, only that ticker is refreshed from yfinance before the response is
returned. This keeps the visible chart fresher without refreshing the full
market universe every 5 minutes.

## Analysis API

Main endpoints:

- `GET /health`
- `GET /tickers`
- `GET /history/{ticker}/latest`
- `GET /candles/{ticker}?range=1D|1W|1M|3M|1Y`
- `GET /candles/{ticker}/meta?range=1D|1W|1M|3M|1Y`
- `GET /candles/{ticker}?start=YYYY-MM-DD&end=YYYY-MM-DD&limit=N`

Candle shape:

```json
{"t": "date-or-datetime", "o": 1, "h": 2, "l": 0.5, "c": 1.5, "v": 1000}
```

`/candles` also returns `updatedAt`, which is the last filesystem update time
of the cache file used by the selected range. The dashboard displays it as
`Mise à jour ...` next to the volume metric.

`/candles/{ticker}/meta` returns only `ticker` and `updatedAt`. The frontend uses
this lightweight response to check whether a full chart refresh is needed.

Range behavior:

| Range | Backend data | Display precision |
| --- | --- | --- |
| `1D` | short intraday cache | 5 minutes, displayed on a fixed regular-session window |
| `1W` | persisted weekly intraday cache | 1 hour |
| `1M` | daily cache + latest intraday overlay | 1 trading day |
| `3M` | daily cache + latest intraday overlay | 1 trading day |
| `1Y` | daily cache + latest intraday overlay | 1 trading day |

Daily ranges contain market sessions, not calendar-day placeholders. For
example, `1M` usually has about 21-23 stock-market points.

For `1D`, the dashboard keeps the horizontal time axis fixed to the regular
stock session. The candle timestamps come from Yahoo, then the chart labels are
rendered in the browser/system timezone. On US assets this means the right edge
is `16:00` on a New York machine and around `22:00` in Paris during daylight
saving time. The line only advances as new 5 minute candles arrive.

The `1D` percentage uses the market-standard daily formula:
`(latest close - previous daily close) / previous daily close`. Longer chart
ranges keep using the displayed range formula:
`(last displayed close - first displayed close) / first displayed close`.

Yahoo intraday candles are timestamped at the start of their interval. For
example, the final regular US candle is stored at `21:55` in Paris during
daylight saving time, but its close represents the `21:55 -> 22:00` interval.
The dashboard plots `1D` candles at the end of their 5 minute interval so the
final point appears at market close.

During an open session, the current day is approximated from the latest `1D`
intraday candle. Once a complete regular session is detected, the active ticker
also refreshes its daily Yahoo candle and the official daily close replaces the
last intraday close. This handles cases where the closing auction/daily close
differs slightly from the last 5 minute candle.

## Dashboard Link

Frontend chart flow:

1. `web/src/components/AssetChart.tsx` asks:
   `/api/assets/candles?symbol=AAPL&range=1W`
2. `web/src/app/api/assets/candles/route.ts` validates the symbol/range.
3. `web/src/lib/analysis-data.ts` calls:
   `${ANALYSIS_URL}/candles/AAPL?range=1W`
4. The dashboard receives normalized candles:
   `datetime`, `open`, `high`, `low`, `close`, `timestamp`, `volume`.

Automatic chart refresh:

1. While the tab is visible, `AssetChart` polls
   `/api/assets/candles/meta?symbol=AAPL&range=1W` every 5 minutes.
2. That meta call can trigger a 5 minute on-demand refresh for the active
   ticker.
3. If `updatedAt` is unchanged, the chart keeps the current candles.
4. If `updatedAt` changed, the chart refetches `/api/assets/candles`.
5. The selected `symbol` and `range` are mirrored in the dashboard URL, so a
   page refresh keeps the same asset and time range.
6. Polling pauses while the browser tab is hidden and checks once when it
   becomes visible again.

Watchlist flow:

1. `web/src/lib/assets.ts` calls `fetchAnalysisAssetSnapshot(symbol)`.
2. That reads the two latest daily candles from `analysis`.
3. `lastPrice`, `dayChange`, and `dayChangePercent` are calculated from those
   candles.
4. The result is persisted in the existing `assets` table for UI caching.

Search flow:

1. `web/src/app/api/assets/search/route.ts` calls `searchAnalysisTickers()`.
2. `searchAnalysisTickers()` reads `${ANALYSIS_URL}/tickers`.
3. Results are currently symbol-only because `analysis` exposes tickers, not
   full provider profiles.
