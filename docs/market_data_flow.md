# Market Data Flow

Mini-reference for how market data is fetched, stored, refreshed, and used by
the dashboard.

## Source

- Market data comes from the local FastAPI `analysis` service.
- `analysis` uses the `yfinance` Python package to download Yahoo Finance data.
- The frontend uses `analysis` for search, watchlist snapshots, and dashboard
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
    `/snapshots`, including `updatedAt`.

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
| Daily | `1d` candles, `1y` or `5y` period | Once per calendar day, or if missing | `1M`, `3M`, `1Y`, watchlist snapshots |
| 1D intraday | `period=1d`, `interval=5m` | Global scheduler on fixed 5 minute boundaries plus 30 seconds | `1D`, latest daily overlay |
| 1W hourly | `period=30d`, `interval=1h` | Base yfinance cache once per day, then hourly merge from `1D` | `1W` |

The hourly merge works like this:

1. Refresh `1D` candles from Yahoo.
2. Aggregate the new 5 minute candles into 1 hour candles.
3. Merge those hourly candles into `analysis/data/weekly_intraday`.
4. Save the merged file, keeping the latest 30 days in cache.

This means `1W` keeps the hourly values on disk instead of only displaying a
temporary overlay. When the daily official close is available, the 1D-derived
hourly merge uses that corrected close for the final hourly candle too.

`/candles`, `/candles/{ticker}/meta`, and `/snapshots` read the local CSV cache;
they do not call Yahoo. Refreshes are owned by startup warmup and the background
scheduler. Intraday refreshes are pinned to fixed 5 minute clock boundaries plus
30 seconds, for example `15:00:30`, `15:05:30`, `15:10:30`; the 30 second delay
does not drift over time.

## Analysis API

Main endpoints:

- `GET /health`
- `GET /tickers`
- `GET /history/{ticker}/latest`
- `GET /snapshots?symbols=AAPL,NVDA`
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
If the immediate previous daily close is missing, the percentage is returned as
unavailable instead of silently comparing against an older session.

Yahoo intraday candles are stored and displayed with the timestamp returned by
Yahoo/analysis. The frontend does not shift intraday points forward, so a
candle timestamped `16:10` is displayed at `16:10`, never at `16:15`.

During an open session, the current day is approximated from the latest `1D`
intraday candle. Once a complete regular session is detected, the daily Yahoo
candle can replace the last intraday close with the official close. This handles
cases where the closing auction/daily close differs slightly from the last 5
minute candle.

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
   `/api/assets/candles/meta?symbol=AAPL&range=1W` on fixed 5 minute
   boundaries plus 30 seconds.
2. That meta call only reads `updatedAt`; backend refreshes are handled by the
   scheduler.
3. If `updatedAt` is unchanged, the chart keeps the current candles.
4. If `updatedAt` changed, the chart refetches `/api/assets/candles`.
5. After a chart refresh, the dashboard compares the selected asset's new
   `lastPrice/dayChangePercent` with the value already loaded in the
   watchlist. It reloads `/api/assets/watchlist` only when that selected asset
   value actually changed.
6. The selected `symbol` and `range` are mirrored in the dashboard URL, so a
   page refresh keeps the same asset and time range.
7. Polling pauses while the browser tab is hidden and checks once when it
   becomes visible again.

Watchlist flow:

1. The dashboard server render sends the symbol list first, without waiting for
   market values.
2. After mount, `DashboardClient` fetches `/api/assets/watchlist`.
3. `web/src/lib/assets.ts` sends one batch request to
   `/snapshots?symbols=AAPL,NVDA,...`.
4. The analysis endpoint reads local CSV caches only; yfinance is not called
   from the watchlist path.
5. `lastPrice`, `dayChange`, and `dayChangePercent` are calculated from the two
   latest daily candles, including the current intraday overlay when present.
6. `AssetChart` uses the same snapshot payload for the daily percentage, so the
   chart header and watchlist do not drift into different formulas.
7. Missing symbols are shown as unavailable until backend refresh jobs populate
   their caches.

Search flow:

1. `web/src/app/api/assets/search/route.ts` calls `searchAnalysisTickers()`.
2. `searchAnalysisTickers()` reads `${ANALYSIS_URL}/tickers`.
3. Results are currently symbol-only because `analysis` exposes tickers, not
   full provider profiles.
