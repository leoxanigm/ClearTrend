# ClearTrend frontend plan

This document is the frontend reference for the current ClearTrend dashboard.
It reflects what has already been implemented and what should come next.

## Product direction

ClearTrend is a finance dashboard for reading market trends in a simple way.
The app should feel calm, focused, and approachable. It is not meant to look
like a dense trading terminal.

Core principles:

- one dominant chart area;
- readable watchlist;
- simple sorting and search;
- clear selected asset state;
- progressive details around the selected asset;
- dark/light theme support;
- responsive layout from desktop to small mobile;
- educational/demo framing, not financial advice.

## Product name

Chosen name: **ClearTrend**.

Reason:

- short and easy to remember;
- clearly linked to market trend reading;
- fits an English evaluation/demo context;
- serious enough for finance without sounding too technical.

## Current frontend status

The frontend is no longer a static shell. The current dashboard has:

- authenticated dashboard route;
- left watchlist sidebar;
- asset search input;
- watchlist sorting;
- selected asset state shared with the chart;
- real quote/profile data from Finnhub;
- real chart candles from Twelve Data;
- responsive SVG chart;
- X/Y axes;
- desktop hover crosshair with date/value tooltip;
- compact mobile chart layout;
- Trend and Sentiment cards below the chart;
- dark/light theme toggle persisted in browser storage.

## Routes

Current app routes:

- `/` - redirects to `/login`;
- `/login` - public login/register page;
- `/dashboard` - protected dashboard;
- `/privacy` - Privacy Policy;
- `/terms` - Terms of Service.

Current dashboard API routes:

- `GET /api/assets/watchlist` - returns normalized watchlist assets;
- `GET /api/assets/search?q=...` - searches assets through Finnhub;
- `GET /api/assets/candles?symbol=AAPL&range=1M` - returns chart candles through Twelve Data;
- auth routes under `/api/auth/*`;
- `GET /api/health`.

## Frontend architecture

### Dashboard page

`web/src/app/dashboard/page.tsx`

- Server component.
- Reads and verifies the session cookie.
- Redirects unauthenticated users to `/login`.
- Loads initial watchlist assets through `getWatchlistAssets()`.
- Passes authenticated user info and watchlist assets to `DashboardClient`.

### Dashboard client shell

`web/src/components/DashboardClient.tsx`

- Client component that owns the active dashboard state.
- Stores `watchlistAssets`.
- Stores `selectedSymbol`.
- Computes `selectedAsset`.
- Renders:
  - desktop sidebar;
  - mobile drawer sidebar;
  - header/user menu;
  - `AssetChart`;
  - Trend and Sentiment cards.

Important decision: selected asset state lives here, not inside the chart or
inside the sidebar. This allows the watchlist and chart to stay synchronized.

### Watchlist navigation

`web/src/components/WatchlistNav.tsx`

Implemented:

- displays asset name, symbol, and day performance;
- positive performance in green;
- negative performance in red;
- `N/A` muted when data is missing;
- sorting by:
  - A-Z;
  - Z-A;
  - best day;
  - worst day;
- `N/A` assets stay at the end when sorting by performance;
- search input calls `/api/assets/search`;
- selecting a search result adds/hydrates the asset through `/api/assets/watchlist`;
- selected asset remains highlighted;
- selecting from search scrolls the watchlist to the selected item;
- desktop sidebar scrolls when the list is taller than the page;
- mobile drawer reuses the same component.

Current limitation:

- adding an asset from search updates the client-side watchlist and stores/updates
  the asset data in the `assets` table, but there is not yet a user-specific
  persisted `watchlists` / `watchlist_items` model.

## Market data architecture

### Finnhub

Files:

- `web/src/lib/finnhub.ts`;
- `web/src/lib/assets.ts`;
- `web/src/app/api/assets/search/route.ts`;
- `web/src/app/api/assets/watchlist/route.ts`.

Finnhub is used for:

- asset search;
- asset profile data;
- current quote data;
- watchlist day performance (`dp`).

Stored asset fields include:

- symbol;
- display symbol;
- name;
- exchange/country/currency/industry when available;
- last price;
- day change;
- day change percent;
- day high/low/open;
- previous close;
- quote timestamp;
- raw Finnhub profile and quote JSON.

Current cache:

- `assetCacheTtlMs = 5 * 60 * 1000`;
- an asset is considered fresh for 5 minutes.

Current improvement to do:

- split profile and quote refresh:
  - profile should be fetched once when an asset is first added;
  - quote should refresh every 5 minutes;
  - this avoids paying two Finnhub calls on every stale refresh.

### Twelve Data

Files:

- `web/src/lib/twelvedata.ts`;
- `web/src/app/api/assets/candles/route.ts`;
- `web/src/components/AssetChart.tsx`.

Twelve Data is used for chart candles through `/time_series`.

Supported chart ranges:

| Range | Interval | Output size | Cache |
|---|---:|---:|---:|
| `1D` | `5min` | 78 | 5 min |
| `1M` | `1day` | 30 | 30 min |
| `3M` | `1day` | 90 | 1 hour |
| `1Y` | `1day` | 252 | 6 hours |

Returned candle data:

- datetime;
- open;
- high;
- low;
- close;
- volume;
- timestamp.

Current limitation:

- candles are cached in memory only;
- they are not persisted in the database yet.

Recommended future step:

- add a `price_candles` table only when we need historical storage,
  backtesting, offline demos, or technical indicators.

## Chart implementation

`web/src/components/AssetChart.tsx`

Implemented:

- custom SVG line/area chart;
- ranges: `1D`, `1M`, `3M`, `1Y`;
- X axis with time/date labels;
- Y axis with price labels;
- range performance percent;
- current/last price display;
- loading state;
- unavailable state;
- footer metadata:
  - number of points;
  - interval;
  - exchange;
  - last volume;
- responsive sizing:
  - desktop chart size: `720 x 400`;
  - compact chart size: `360 x 230`;
  - compact mode activates under `600px`;
- desktop hover interaction:
  - vertical dashed guide;
  - horizontal dashed guide;
  - point marker;
  - tooltip with value and date.

Current chart choice:

- no external chart library yet;
- custom SVG is enough for the current simple line chart;
- adding ECharts/Recharts can be reconsidered later if we need candles,
  volume bars, indicators, zoom, or advanced interactions.

## Responsive behavior

Desktop:

- fixed left sidebar;
- dashboard content takes the remaining width;
- chart spans full dashboard width;
- Trend and Sentiment cards sit below the chart in a two-column grid;
- watchlist scrolls inside the sidebar.

Mobile/tablet:

- desktop sidebar is hidden;
- mobile drawer opens from the left;
- chart header stacks;
- long asset names wrap;
- compact chart mode reduces the SVG viewBox and removes excess frame height;
- hover tooltip is desktop-only.

Important CSS areas:

- app shell and sidebar: `web/src/app/globals.css`;
- watchlist styles: `web/src/app/globals.css`;
- chart styles: `web/src/app/globals.css`;
- compact chart breakpoint: `@media (max-width: 600px)`.

Operational note:

- in Docker dev, `/app/.next` is mounted as an anonymous volume;
- if CSS looks stale after pull/push/restart, recreate the web container with
  renewed anonymous volumes:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --no-deps --force-recreate --renew-anon-volumes web
```

## Theme and styling

Theme foundations are implemented with CSS variables.

Dark theme tokens:

| Token | Value | Role |
|---|---:|---|
| `background` | `#0B1116` | Main app background |
| `surface` | `#111A22` | Cards, panels, app shell |
| `panel` | `#16232D` | Nested/highlight sections |
| `border` | `#263642` | Dividers and borders |
| `text` | `#EAF2F5` | Primary text |
| `muted` | `#8FA4AE` | Secondary text |
| `accent` | `#2DD4BF` | Selected state, chart highlights |
| `secondary` | `#2563EB` | Secondary highlight |

Light theme tokens:

| Token | Value | Role |
|---|---:|---|
| `background` | `#F6F8FA` | Main app background |
| `surface` | `#FFFFFF` | Cards, panels, app shell |
| `panel` | `#EEF4F6` | Nested/highlight sections |
| `border` | `#DCE5EA` | Dividers and borders |
| `text` | `#102027` | Primary text |
| `muted` | `#647985` | Secondary text |
| `accent` | `#0F766E` | Selected state, chart highlights |
| `secondary` | `#1D4ED8` | Secondary highlight |

Implemented:

- theme follows system preference by default;
- manual `ThemeSwitch`;
- selected theme persists in `localStorage` under `cleartrend-theme`.

## Components

Implemented reusable components:

- `AppLogo`;
- `FooterLinks`;
- `Button`;
- `TextInput`;
- `SegmentedControl`;
- `ThemeSwitch`;
- `WatchlistNav`;
- `AssetChart`;
- `DashboardClient`.

Near-term candidates for the 10-component design system target:

- `Card`;
- `MetricTile`;
- `Select`;
- `Tooltip`;
- `Drawer`;
- `UserMenu`.

## Current checklist

### Routes and auth

- [x] `/` redirects to `/login`.
- [x] `/login` exists.
- [x] `/dashboard` exists.
- [x] `/privacy` exists.
- [x] `/terms` exists.
- [x] Privacy Policy has non-empty content.
- [x] Terms of Service has non-empty content.
- [x] Email/password register route exists.
- [x] Email/password login route exists.
- [x] Passwords are hashed server-side.
- [x] Session cookie exists.
- [x] Logout route exists.
- [x] `/dashboard` is protected.
- [ ] Shared front/back validation schema exists.

### Dashboard

- [x] Left sidebar exists.
- [x] Mobile drawer exists.
- [x] Watchlist displays real asset data.
- [x] Watchlist sorting exists.
- [x] Watchlist search exists.
- [x] Search results can add/select an asset.
- [x] Selected asset remains highlighted.
- [x] Chart placeholder is replaced by `AssetChart`.
- [x] Chart consumes real Twelve Data candles.
- [x] Chart has ranges.
- [x] Chart has axes.
- [x] Chart has desktop hover crosshair and tooltip.
- [x] Trend and Sentiment cards are below the chart.
- [x] Mobile chart layout is compact under 600px.
- [ ] Trend and Sentiment cards use real analysis data.
- [ ] User-specific persisted watchlist exists.

### Data and APIs

- [x] `Asset` model exists.
- [x] Finnhub key is documented in `.env.example`.
- [x] Twelve Data key is documented in `.env.example`.
- [x] `/api/assets/watchlist` exists.
- [x] `/api/assets/search` exists.
- [x] `/api/assets/candles` exists.
- [x] Finnhub quote/profile data is stored in `assets`.
- [x] Twelve Data candles are cached in memory.
- [ ] Profile and quote refresh are split.
- [ ] Candles are persisted if needed.
- [ ] API rate limiting exists.

### Styling and quality

- [x] Light theme variables exist.
- [x] Dark theme variables exist.
- [x] Manual theme toggle exists.
- [x] Theme preference persists in browser storage.
- [x] Desktop layout is usable.
- [x] Mobile layout is usable.
- [x] Chart layout has compact mobile handling.
- [ ] Playwright/manual visual checklist exists.
- [ ] Chrome console clean checklist exists.

## Next recommended work

Recommended order:

1. Persist user watchlists.
   Add `watchlists` and `watchlist_items` models, then make search additions
   durable per user.

2. Split Finnhub profile and quote refresh.
   Fetch profile once on asset creation, then refresh only quote every 5 minutes.

3. Connect Trend and Sentiment cards to real analysis data.
   For now they are UI placeholders.

4. Add shared validation.
   A Zod schema or equivalent should cover auth inputs, symbols, chart ranges,
   and asset search query limits.

5. Add a manual/Playwright evaluation checklist.
   Cover login, register, logout, dashboard, watchlist search, chart ranges,
   chart hover, mobile drawer, legal pages, health route, and console warnings.

6. Decide whether to keep custom SVG chart or move to a chart library.
   Stay custom while needs are simple. Consider ECharts/Recharts only when
   candles, volume bars, zoom, overlays, or indicators become necessary.

## Open decisions

- Should watchlists be single-list per user or multiple named lists?
- Should candles be stored in Postgres or kept API/cache-only for now?
- Should crypto symbols be supported in the same UI, given symbol validation and
  different providers?
- Should chart interactions be mobile tap-based later, or remain desktop-only?
- Which real source should power Sentiment and Trend first: FastAPI analysis,
  news ingestion, or a simple technical indicator baseline?
