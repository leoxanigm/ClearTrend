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
also refresh the active ticker from yfinance when its 1D cache is older than 5
minutes. `/candles/{ticker}` returns the latest cached payload immediately.

**Candle keys** : `t` date/time, `o` open, `h` high, `l` low, `c` close, `v` volume

`/candles/{ticker}` also returns `updatedAt`, the last update time of the cache
file used for the selected range.

`/candles/{ticker}/meta` returns only `ticker` and `updatedAt` for lightweight
refresh checks.

## Code layout

- `market_data.py`: stable public facade imported by `main.py`, `scheduler.py`,
  and `database_builder.py`.
- `market_data_config.py`: paths, periods, intervals, 5y ticker list, ticker
  normalization.
- `market_data_storage.py`: CSV snapshots, cache timestamps, refresh markers.
- `market_data_fetcher.py`: Yahoo/yfinance downloads and S&P 500 ticker source.
- `market_data_history.py`: cache warmup, intraday/daily merge rules, official
  close correction.
- `market_data_views.py`: API payloads for candles, latest, and `updatedAt`.

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
