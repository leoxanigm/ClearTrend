import type { ChartCandle, ChartRange } from "@/lib/analysis-data";

export const chartExportFormat = "cleartrend-chart";
export const chartExportVersion = 1;

export type ChartExportContext = {
  candles: ChartCandle[];
  interval: string | null;
  range: ChartRange;
  source: string | null;
  symbol: string;
  updatedAt: string | null;
};

type ChartExportRow = {
  changePercent: number | null;
  close: number;
  datetime: string;
  high: number;
  low: number;
  open: number;
  volume: number | null;
};

function round(value: number, digits = 6) {
  const factor = 10 ** digits;

  return Math.round(value * factor) / factor;
}

function getCandleChangePercent(candle: ChartCandle) {
  if (candle.open <= 0) {
    return null;
  }

  return round(((candle.close - candle.open) / candle.open) * 100);
}

function createExportRows(candles: ChartCandle[]): ChartExportRow[] {
  return candles.map((candle) => ({
    changePercent: getCandleChangePercent(candle),
    close: candle.close,
    datetime: candle.datetime,
    high: candle.high,
    low: candle.low,
    open: candle.open,
    volume: candle.volume,
  }));
}

export function createChartJsonExport(context: ChartExportContext) {
  return JSON.stringify(
    {
      candles: createExportRows(context.candles),
      exportedAt: new Date().toISOString(),
      format: chartExportFormat,
      interval: context.interval,
      range: context.range,
      source: context.source,
      symbol: context.symbol,
      updatedAt: context.updatedAt,
      version: chartExportVersion,
    },
    null,
    2
  );
}

function escapeCsvValue(value: string | number | null) {
  if (value === null) {
    return "";
  }

  const text = String(value);

  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function createChartCsvExport(context: ChartExportContext) {
  const rows = createExportRows(context.candles);
  const header = [
    "symbol",
    "range",
    "datetime",
    "open",
    "high",
    "low",
    "close",
    "volume",
    "change_percent",
  ];
  const lines = rows.map((row) =>
    [
      context.symbol,
      context.range,
      row.datetime,
      row.open,
      row.high,
      row.low,
      row.close,
      row.volume,
      row.changePercent,
    ]
      .map(escapeCsvValue)
      .join(",")
  );

  return [header.join(","), ...lines].join("\n");
}

export function createChartExportFileName(
  symbol: string,
  range: ChartRange,
  extension: "csv" | "json",
  date = new Date()
) {
  const datePart = date.toISOString().slice(0, 10);

  return `cleartrend-${symbol.toLowerCase()}-${range.toLowerCase()}-${datePart}.${extension}`;
}
