# Analysis API

**Filters** :
- `start=YYYY-MM-DD` : keep rows on or after this date
- `end=YYYY-MM-DD` : keep rows on or before this date
- `limit=N` : keep the N most recent rows
- `range=1D|1W|1M|3M|1Y` : use product chart windows

`range=1D` returns 5 minute intraday candles. `range=1W` returns persisted
1 hour candles. `1M`, `3M`, and `1Y` return daily candles; the last daily
candle is updated from the latest intraday cache when possible.

**Refresh cadence** : daily and 1W yfinance history are refreshed once per
calendar day when missing/stale. The 1D cache is refreshed hourly and then
merged into the persisted 1W hourly cache. Requests for `/candles/{ticker}/meta`
also refresh the active ticker from yfinance when its next fixed 5 minute candle
boundary is due plus 30 seconds. `/candles/{ticker}` returns the latest cached
payload immediately.

**Candle keys** : `t` date/time, `o` open, `h` high, `l` low, `c` close, `v` volume

`/candles/{ticker}` also returns `updatedAt`, the last update time of the cache
file used for the selected range.

`/candles/{ticker}/meta` returns only `ticker` and `updatedAt` for lightweight
refresh checks. `/snapshots` returns batch watchlist values from cached data
without calling Yahoo.

## Code layout

- `market_data.py`: stable public facade imported by `main.py`, `scheduler.py`,
  and `database_builder.py`.
- `market_data_config.py`: paths, periods, intervals, 5y ticker list, ticker
  normalization.
- `market_data_storage.py`: CSV snapshots, cache timestamps, refresh markers.
- `market_data_fetcher.py`: Yahoo/yfinance downloads and S&P 500 ticker source.
- `market_data_history.py`: cache warmup, intraday/daily merge rules, official
  close correction.
- `market_data_views.py`: API payloads for candles, snapshots, latest, and
  `updatedAt`.
- `ml/historical_regression.py`: OHLCV features, Ridge Regression, chronological
  backtests, estimated prices, and normalized trend scores.
- `ml/reddit_sentiment.py`: seven-day Reddit RSS sampling and Gemini sentiment.
- `ml/attention_signal.py`: ApeWisdom mention and rank attention.
- `ml/trend_ensemble.py`: multi-source weighting, trend, and confidence.
- `ml/prediction_store.py`: daily per-asset training orchestration, atomic JSON
  snapshots, model versioning, and cache status.

## Health

```bash
curl http://localhost:8000/health
```
```json
{"status":"ok","service":"analysis"}
```

## Tickers (S&P 500 + S&P 500 index + Nasdaq Composite + BTC/ETH)

```bash
curl http://localhost:8000/tickers
```
```json
{"tickers": ["A", "AAPL", "ABBV", "ABNB", "ABT", "ACGL", "ACN", "ADBE", "..."]}
```

## ML trend prediction

The ML universe is intentionally limited to assets with five years of cached
history:

```bash
curl http://localhost:8000/ml/assets
```

```json
{"tickers":["GSPC","IXIC","BTC-USD","ETH-USD","GC=F","GOOGL","NVDA"]}
```

Read the latest shared prediction for all three horizons:

```bash
curl "http://localhost:8000/ml/analyse/NVDA"
```

Read one cached horizon:

```bash
curl "http://localhost:8000/ml/analyse/NVDA?horizon=1W"
```

Required environment for social sentiment:

```dotenv
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash-lite
```

Inspect training freshness:

```bash
curl "http://localhost:8000/ml/status"
```

The daily backend job runs after the daily market-data refresh. It trains each
asset independently, writes one JSON snapshot per asset under
`/app/data/ml_predictions`, and skips a repeated run when the model version,
Gemini configuration, training day, and latest daily candle are unchanged.

API requests only read these files. They do not fit a model, call Reddit,
Gemini, or ApeWisdom. The endpoint still serves the historical component when a
social source was unavailable during the scheduled run.

## Latest

```bash
curl http://localhost:8000/history/NVDA/latest
```
```json
{
  "ticker": "NVDA",
  "date": "2026-05-13",
  "data": {"Open": 224.93, "High": 227.84, "Low": 221.57, "Close": 225.83, "Adj Close": 225.83, "Volume": 149316500.0}
}
```

## Snapshots

```bash
curl "http://localhost:8000/snapshots?symbols=NVDA,AAPL"
```
```json
{
  "snapshots": [
    {"symbol": "NVDA", "name": "NVDA", "lastPrice": 218.66, "dayChange": 3.91, "dayChangePercent": 1.82, "updatedAt": "2026-06-05T13:04:46+00:00"}
  ]
}
```

## Candles

```bash
curl "http://localhost:8000/candles/BTC-USD?limit=2"
```
```json
{
  "ticker": "BTC-USD",
  "candles": [
    {"t": "2026-05-13", "o": 80476.79, "h": 81276.67, "l": 78725.51, "c": 79277.12, "v": 34075428359.0},
    {"t": "2026-05-14", "o": 79283.34, "h": 79894.41, "l": 79001.51, "c": 79714.08, "v": 35588632576.0}
  ]
}
```

```bash
curl "http://localhost:8000/candles/AAPL?range=1D"
```
