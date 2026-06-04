# Market Data Provider Migration

This note tracks what must be removed or changed when the app fully moves away
from Finnhub and Twelve Data.

## Provider Roles During Transition

- Finnhub remains in the repository during the transition, but frontend asset
  search and watchlist pricing are now served by `analysis`.
- Twelve Data remains in the repository during the transition, but dashboard
  chart candles are now served by `analysis`.
- The local analysis service already exposes market history data through
  `ANALYSIS_URL`, including `/health`, `/tickers`, `/history/{ticker}/latest`,
  and `/candles/{ticker}`.
- `range=1D` uses the 5 minute intraday cache. `1W` uses a persisted 1 hour
  cache rebuilt from yfinance once per day and completed hourly from `1D`.
  `1M`, `3M`, and `1Y` use daily candles with the last day updated from the
  latest intraday cache when available.

## Files To Remove Later

- `web/src/lib/finnhub.ts`
- `web/src/lib/twelvedata.ts`
- `web/src/lib/external-data.ts`, if no other fallback or external cooldown
  logic remains.

## Environment Variables To Remove Later

- `FINNHUB_API_KEY`
- `TWELVEDATA_API_KEY`

Keep `ANALYSIS_URL`. If the analysis API is protected, add and document an
`ANALYSIS_TOKEN` or equivalent server-to-server secret.

## Web Routes To Change

- `web/src/app/api/assets/search/route.ts`
  - Done: Finnhub search has been replaced with `analysis` `/tickers`.
  - Decide whether the UI only needs symbols, or whether the analysis service
    should also expose names, exchanges, asset types, and display symbols.

- `web/src/app/api/assets/candles/route.ts`
  - Done: Twelve Data candles have been replaced with `analysis`
    `/candles/{ticker}`.
  - The current response shape for the dashboard is still:
    `datetime`, `open`, `high`, `low`, `close`, `timestamp`, `volume`.

- `web/src/app/api/assets/watchlist/route.ts`
  - Keep the user favorite/watchlist persistence in Postgres.
  - Done: prices and daily movement now come from `analysis` through
    `web/src/lib/assets.ts`.

## Web Libraries To Change

- `web/src/lib/assets.ts`
  - Done: the sync path uses `fetchAnalysisAssetSnapshot`.
  - Remove Finnhub-specific fields from the sync path:
    `displaySymbol`, `description`, `type`, `exchange`, `mic`, `currency`,
    `country`, `industry`, `logoUrl`, `webUrl`, `ipoDate`, `marketCap`,
    `shareOutstanding`, `figi`, `rawProfile`, `rawQuote`.
  - Keep or replace:
    `symbol`, `name`, `lastPrice`, `dayChange`, `dayChangePercent`,
    `dataFetchedAt`, and user favorite symbols.

- `web/src/components/AssetChart.tsx`
  - Done: `ChartCandle` and `ChartRange` now live in
    `web/src/lib/analysis-data.ts`.
  - Keep the UI mostly unchanged while `/api/assets/candles` preserves its
    current normalized response.

- `web/src/components/WatchlistNav.tsx`
  - Asset search result labels may need to become symbol-only unless analysis
    exposes asset names.

## Prisma Cleanup Later

The `Asset` model can be simplified after Finnhub is removed. Likely removable
fields:

- `displaySymbol`
- `description`
- `type`
- `exchange`
- `mic`
- `currency`
- `country`
- `industry`
- `logoUrl`
- `webUrl`
- `ipoDate`
- `marketCap`
- `shareOutstanding`
- `figi`
- `dayHigh`
- `dayLow`
- `dayOpen`
- `previousClose`
- `quoteTimestamp`
- `fetchAttemptedAt`
- `rawProfile`
- `rawQuote`

Before dropping those fields, update `web/src/app/api/search/route.ts`, because
asset search currently filters and renders several of them.

## Frontend Migration Strategy

1. Use `analysis` as the only source for candles, watchlist prices, and ticker
   search. Done for the active frontend paths.
2. Keep Finnhub/Twelve Data files in the repository during the transition, but
   do not call them from the frontend routes once `analysis` is connected.
3. Once the analysis dataset covers all symbols needed by the product, remove
   provider env vars, provider libraries, and Prisma fields.
4. Run `npm run prisma:generate`, `npm run db:push` or a migration, lint, and
   build.
