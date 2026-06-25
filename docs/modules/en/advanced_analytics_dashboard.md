# Module Advanced Analytics Dashboard

## Status

- Type: major module
- Value: 2 points
- Status: implemented and validated
- Page: `/dashboard`

The subject requires:

- interactive charts;
- several visualization types;
- real-time data updates;
- PDF, CSV, or other export;
- date ranges and customizable filters.

ClearTrend covers this scope with OHLCV financial data provided by the FastAPI
`analysis` service.

The `Trend` and `Sentiment` tiles are now powered by the ML module. They enrich
the dashboard, but are not required to justify this module: validation relies
on charts, filters, refresh, and exports.

## General Architecture

**Related files:**

- [`dashboard/page.tsx`](../../../web/src/app/dashboard/page.tsx#L14): initial server loading of the page;
- [`candles/route.ts`](../../../web/src/app/api/assets/candles/route.ts#L14): authenticated Next.js route;
- [`main.py`](../../../analysis/src/main.py#L159): FastAPI endpoint that provides candles.

The dashboard crosses the following three layers:

```text
React browser
  AssetChart / DashboardClient
            |
            | GET /api/assets/candles
            v
Next.js backend
  authentication, validation, normalization
            |
            | internal Docker REST
            v
FastAPI analysis service
  OHLCV cache and metadata reading
```

The browser never contacts FastAPI directly. Next.js routes first verify the
user session or API key, then forward a request limited to accepted symbols and
ranges.

This separation makes it possible to:

- avoid exposing the `analysis` microservice address to the client;
- centralize authentication in the web backend;
- normalize data before React uses it;
- keep FastAPI specialized in financial data.

A page reload or range change does not directly trigger a download from the
financial provider. FastAPI serves shared caches, updated in the background by
the scheduler. All users therefore consult the same market version.

## User Flow

**Related files:**

- [`DashboardClient.tsx`](../../../web/src/components/DashboardClient.tsx#L149): asset and range selection;
- [`AssetChart.tsx`](../../../web/src/components/AssetChart.tsx#L575): controls and chart display.

From the dashboard, the user can:

1. choose an asset from the watchlist;
2. choose a range;
3. display the price as a line chart;
4. display OHLC values as candlesticks;
5. inspect a point with the mouse;
6. export the visible data as CSV or JSON.

The symbol and range are also preserved in the URL:

```text
/dashboard?symbol=AAPL&range=1M
```

This link restores the same view directly.

## Data Used

**Related files:**

- [`analysis-data.ts`](../../../web/src/lib/analysis-data.ts#L357): FastAPI call, validation, and normalization;
- [`market_data/views.py`](../../../analysis/src/market_data/views.py#L68): history selection by range;
- [`market_data/history.py`](../../../analysis/src/market_data/history.py#L502): OHLCV cache reading and composition.

The frontend calls:

```text
GET /api/assets/candles?symbol=AAPL&range=1M
```

A candle contains:

- `datetime`: date and, for intraday data, time of the period;
- `open`: price at the beginning of the period;
- `high`: highest price reached during the period;
- `low`: lowest price reached during the period;
- `close`: price at the end of the period;
- `volume`: quantity of assets traded during the period.

### Full Data Cycle

1. `DashboardClient` keeps the selected asset and range.
2. `AssetChart` calls the Next.js route with `symbol` and `range`.
3. The route verifies identity and rejects an invalid symbol.
4. `analysis-data.ts` calls FastAPI over the Docker network.
5. FastAPI selects the cache appropriate for the range.
6. The compact fields `t`, `o`, `h`, `l`, `c`, `v` are validated and converted
   into `ChartCandle`.
7. The component applies the full response, then recalculates the SVG locally.

A previous request is cancelled with `AbortController` if the user changes
asset or range quickly. An obsolete response therefore cannot replace the new
selection.

### Granularity and Caches

**Related files:**

- [`get_candles`](../../../analysis/src/market_data/views.py#L68): maps each range to a data source;
- [`load_intraday_history_with_official_close`](../../../analysis/src/market_data/history.py#L287): corrects the last intraday candle;
- [`load_daily_history_with_latest`](../../../analysis/src/market_data/history.py#L502): adds the current session to daily history.

| Range | Granularity | Served source |
|---|---|---|
| `1D` | 1, 5, or 15 minutes | intraday cache according to the admin setting, corrected with the official close when it exists |
| `1W` | 1 hour | weekly intraday cache |
| `1M`, `3M`, `1Y` | 1 day | daily history completed by the current session |

This composition makes it possible to display the current session without
waiting for the next official daily candle to be published.

### Changing the `1D` Interval

The administration setting now controls both the collection frequency and the
granularity of `1D` candles:

| Setting | Yahoo interval | Visualization |
|---|---|---|
| 1 minute | `1m` | one candle per minute |
| 5 minutes | `5m` | one candle every five minutes |
| 15 minutes | `15m` | one candle every fifteen minutes |

The mapping is centralized in
[`market_data/config.py`](../../../analysis/src/market_data/config.py#L42).
FastAPI returns the interval actually served with the candles, so the frontend
displays it without maintaining a second configuration.

After a change, the scheduler rereads the setting in less than one minute.
While the new cache is being created, the dashboard temporarily keeps the most
recent available cache to avoid an empty chart. The new interval is used only
when it reaches the latest known candle, covers the same period, and contains
enough points for its granularity. This prevents a partial `1m` download from
replacing the `5m` chart prematurely.

## Visualizations

**Related files:**

- [`buildChartData`](../../../web/src/components/AssetChart.tsx#L388): SVG axis, point, line, and candlestick computation;
- [`chart-layout.ts`](../../../web/src/lib/chart-layout.ts#L24): responsive candlestick width;
- [`globals.css`](../../../web/src/app/globals.css#L1253): chart, axis, and tooltip appearance.

The chart is drawn directly in SVG by React. No external visualization library
is used.

This choice gives precise control over axes, candlestick width, tooltips, and
mobile rendering. It also avoids adding a heavy dependency for two well-defined
financial representations. In return, coordinate, domain, and tooltip placement
calculations are maintained in the project.

### Price Line

The `Price` view displays:

- the close of each candle;
- a line and colored area;
- time and financial axes;
- period performance;
- a tooltip with date and price.

### OHLC Candlesticks

The `Candles` view uses the same data and displays:

- a wick between the `low` minimum and `high` maximum;
- a body between the `open` and `close`;
- a green candle when the close is greater than or equal to the open;
- a red candle when the close is lower than the open;
- a compact tooltip with the date and full labels `Open`, `High`, `Low`, and
  `Close`.

Candlestick width uses the median spacing between points. In `1D`, it is capped
to avoid candles becoming too wide when the provider temporarily returns few
points.

## Ranges and Filters

**Related files:**

- [`visibleCandles`](../../../web/src/components/AssetChart.tsx#L847): local filtering between selected dates;
- [`handleRangeChange`](../../../web/src/components/DashboardClient.tsx#L342): range change and URL synchronization;
- [`performance/route.ts`](../../../web/src/app/api/assets/performance/route.ts#L13): watchlist performance for the active range.

Available filters:

- asset selected in the watchlist;
- chart range among `1D`, `1W`, `1M`, `3M`, and `1Y`;
- custom start and end dates within the loaded range;
- `Price` or `Candles` visualization type;
- watchlist performance range.

Asset and range changes reload the corresponding candles. The start/end filter
then works locally on those candles. For `1D` and `1W`, it also accepts the
time. The chart, point count, and exports only use the remaining candles.

Local filtering was chosen because the product range is already bounded and
loaded in the browser. Changing a date therefore does not trigger another
server request and the result is immediate. However, this filter cannot request
an arbitrary period outside the loaded range.

`1D` snapshots and watchlist performances are loaded in batches of 20 symbols,
with two concurrent batches. Identical in-flight requests are shared between
users and results are kept for 30 seconds on the `web` side. The selector shows
`...` while loading; `N/A` then indicates a real absence of data for the asset
and range.

## Automatic Refresh

**Related files:**

- [`fetchChartMeta`](../../../web/src/components/AssetChart.tsx#L157): lightweight browser-side freshness check;
- [`candles/meta/route.ts`](../../../web/src/app/api/assets/candles/meta/route.ts#L14): authenticated metadata proxy;
- [`market-calendar.ts`](../../../web/src/lib/market-calendar.ts#L207): next regular opening calculation;
- [`scheduler.py`](../../../analysis/src/scheduler.py#L93): cache updates independent from users.

The dashboard uses the frequency configured by the administrator, with a
minimum value of one minute.

How it works:

1. the chart loads candles when it opens;
2. it then checks `/api/assets/candles/meta` to read only `updatedAt`;
3. it reloads full candles only when that value has changed;
4. if a background refresh fails, it keeps the chart already visible;
5. when the tab becomes visible again, it immediately checks the data.

The footer displays the source, interval, point count, last market candle date,
and relative cache update date. This separation avoids confusing a last Friday
session with a refreshed cache or an export made during the weekend.

It also displays the next regular opening of the US market. The calculation
uses 9:30 in New York, ignores weekends and the main NYSE holidays, then shows
the result in the browser's local timezone.

`updatedAt` represents the modification date of the cache used by the range. An
identical value means the browser already has the latest version and avoids
transferring the same history again. A network error is retried after 30
seconds without clearing visible data.

The FastAPI scheduler runs independently of users:
[`run_market_data_scheduler`](../../../analysis/src/scheduler.py#L93). It
reloads intraday histories according to the configured frequency, daily
histories once per day, and rebuilds the weekly hourly cache when needed.

This mechanism relies on polling. It should not be confused with the separate
WebSocket/SSE module.

## CSV Export

**Related files:**

- [`createChartCsvExport`](../../../web/src/lib/chart-analytics.ts#L88): CSV content construction;
- [`downloadChartData`](../../../web/src/components/AssetChart.tsx#L917): local file download.

The `Export CSV` button generates a file:

```text
cleartrend-aapl-1m-YYYY-MM-DD.csv
```

The date in the file name is the export date. The date of each market point
remains present in the `datetime` column.

Columns:

```text
symbol
range
datetime
open
high
low
close
volume
change_percent
```

`change_percent` is the variation between the candle open and close.

## JSON Export

**Related files:**

- [`createChartJsonExport`](../../../web/src/lib/chart-analytics.ts#L58): versioned JSON document;
- [`downloadChartData`](../../../web/src/components/AssetChart.tsx#L917): `Blob` creation and download.

The `Export JSON` button generates a versioned document:

```json
{
  "format": "cleartrend-chart",
  "version": 1,
  "symbol": "AAPL",
  "range": "1M",
  "interval": "1day",
  "source": "Analysis",
  "updatedAt": "2026-06-07T12:00:00Z",
  "exportedAt": "2026-06-07T12:01:00Z",
  "candles": []
}
```

Each `candles` entry contains OHLCV values and candle variation.

Files are generated locally in the browser from already authenticated data. No
temporary file is stored on the server.

This approach avoids unnecessary server storage and guarantees that the export
matches exactly the currently visible filter.

## Managed States

**Related file:**

- [`AssetChart.tsx`](../../../web/src/components/AssetChart.tsx#L575): loading, error, missing data states, and preservation of the last valid chart.

The chart handles:

- loading;
- fetch error;
- no data;
- export buttons disabled without data;
- chart preservation when a background refresh fails.

## Responsive and Accessibility

**Related files:**

- [`AssetChart.tsx`](../../../web/src/components/AssetChart.tsx#L1017): ARIA attributes and mobile controls;
- [`globals.css`](../../../web/src/app/globals.css#L1253): desktop chart layout;
- [`globals.css`, mobile media](../../../web/src/app/globals.css#L1855): control collapse and compact dimensions.

On mobile:

- ranges `1D` to `1Y` always remain visible under the title;
- a chevron button collapses dates, chart type, and exports by default;
- controls are distributed over several rows;
- export buttons use the full available width;
- the chart uses a compact format;
- the mouse tooltip is hidden to avoid inconsistent touch interaction.

Controls use native buttons, `aria-pressed` for ranges, and accessible labels
for visualizations and exports.

## Automated Tests

**Related files:**

- [`test-chart-export.mjs`](../../../tests/scripts/test-chart-export.mjs): automated module scenarios;
- [`Makefile`](../../../Makefile#L85): `make test-analytics-dashboard` command.

Command:

```bash
make test-analytics-dashboard
```

The test verifies:

- CSV columns;
- OHLCV rows;
- percentage variation;
- missing values;
- JSON format and version;
- chart metadata;
- exported file name;
- next opening before and after 9:30 in New York;
- weekends, an NYSE holiday, and daylight-saving time transitions.

The script covers the most sensitive pure calculations. Visual rendering and
mouse/touch interactions remain manually verified.

Global verification:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T web npm run lint
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T web npm run build
```

## Recommended Manual Test

1. open `/dashboard` with a signed-in account;
2. select `AAPL`;
3. browse ranges `1D`, `1W`, `1M`, `3M`, `1Y`;
4. limit the view with the start and end fields;
5. on desktop, hover several points of the line;
6. switch from `Price` to `Candles`;
7. verify high/low wicks, open/close bodies, and the OHLC tooltip;
8. export CSV and check the columns and filtered period;
9. export JSON and check `format`, `version`, `symbol`, and `range`;
10. change asset and verify that export names and content change;
11. in the network tab, wait for a refresh and verify that `/candles/meta` is
    called before any `/candles` reload;
12. reduce the window to verify mobile controls.

## Accepted Limitations

- The dashboard uses polling, not WebSocket/SSE.
- The available exports are CSV and JSON, not PDF.
- The next opening uses the regular US calendar. This indication is not suited
  to Bitcoin and Ethereum, which trade 24/7, or to all international calendars
  and futures contracts.

These limitations do not remove any of the module's main flows: several
interactive visualizations, filters, ranges, updates, and export are available.
