import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const webRoot = process.env.TEST_WEB_ROOT ?? path.resolve("web");
const chartExportModule = await import(
  pathToFileURL(path.join(webRoot, "src/lib/chart-analytics.ts")).href
);
const marketCalendarModule = await import(
  pathToFileURL(path.join(webRoot, "src/lib/market-calendar.ts")).href
);
const chartLayoutModule = await import(
  pathToFileURL(path.join(webRoot, "src/lib/chart-layout.ts")).href
);
const {
  chartExportFormat,
  chartExportVersion,
  createChartCsvExport,
  createChartExportFileName,
  createChartJsonExport,
} = chartExportModule;
const { getNextMarketOpen } = marketCalendarModule;
const { getCandlestickWidth } = chartLayoutModule;

const candles = [
  {
    close: 102,
    datetime: "2026-06-05 14:30:00",
    high: 103,
    low: 99,
    open: 100,
    timestamp: Date.parse("2026-06-05T14:30:00Z"),
    volume: 1200,
  },
  {
    close: 99,
    datetime: "2026-06-05 14:35:00",
    high: 104,
    low: 98,
    open: 102,
    timestamp: Date.parse("2026-06-05T14:35:00Z"),
    volume: null,
  },
];
const context = {
  candles,
  interval: "5min",
  range: "1D",
  source: "Analysis",
  symbol: "AAPL",
  updatedAt: "2026-06-05T14:35:10Z",
};

const csv = createChartCsvExport(context);
const csvLines = csv.split("\n");

assert.equal(
  csvLines[0],
  "symbol,range,datetime,open,high,low,close,volume,change_percent"
);
assert.equal(csvLines.length, 3);
assert.equal(
  csvLines[1],
  "AAPL,1D,2026-06-05 14:30:00,100,103,99,102,1200,2"
);
assert.equal(
  csvLines[2],
  "AAPL,1D,2026-06-05 14:35:00,102,104,98,99,,-2.941176"
);

const json = JSON.parse(createChartJsonExport(context));

assert.equal(json.format, chartExportFormat);
assert.equal(json.version, chartExportVersion);
assert.equal(json.symbol, "AAPL");
assert.equal(json.range, "1D");
assert.equal(json.interval, "5min");
assert.equal(json.source, "Analysis");
assert.equal(json.candles.length, 2);
assert.equal(json.candles[0].changePercent, 2);
assert.equal(json.candles[1].volume, null);
assert.ok(Number.isFinite(Date.parse(json.exportedAt)));

assert.equal(
  createChartExportFileName(
    "AAPL",
    "1D",
    "csv",
    new Date("2026-06-07T12:00:00Z")
  ),
  "cleartrend-aapl-1d-2026-06-07.csv"
);

assert.equal(
  getNextMarketOpen(new Date("2026-06-07T22:40:00Z")).toISOString(),
  "2026-06-08T13:30:00.000Z"
);
assert.equal(
  getNextMarketOpen(new Date("2026-06-08T13:00:00Z")).toISOString(),
  "2026-06-08T13:30:00.000Z"
);
assert.equal(
  getNextMarketOpen(new Date("2026-06-08T14:00:00Z")).toISOString(),
  "2026-06-09T13:30:00.000Z"
);
assert.equal(
  getNextMarketOpen(new Date("2026-07-02T15:00:00Z")).toISOString(),
  "2026-07-06T13:30:00.000Z"
);
assert.equal(
  getNextMarketOpen(new Date("2026-01-04T18:00:00Z")).toISOString(),
  "2026-01-05T14:30:00.000Z"
);

assert.equal(getCandlestickWidth([0], 640, "1D"), 6);
assert.equal(getCandlestickWidth([0, 8, 16, 24], 640, "1D"), 4.96);
assert.equal(getCandlestickWidth([0, 80, 160], 640, "1D"), 6);
assert.equal(getCandlestickWidth([0, 80, 160], 640, "1M"), 14);

console.log("Analytics chart CSV/JSON exports: all tests passed.");
