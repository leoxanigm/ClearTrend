# Analysis API

**Filters** :
- `start=YYYY-MM-DD` : keep rows on or after this date
- `end=YYYY-MM-DD` : keep rows on or before this date
- `limit=N` : keep the N most recent rows

**Candle keys** : `t` date, `o` open, `h` high, `l` low, `c` close, `v` volume

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
