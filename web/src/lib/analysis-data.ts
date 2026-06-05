import { getAssetDisplayName } from "@/lib/asset-labels";

export const chartRanges = ["1D", "1W", "1M", "3M", "1Y"] as const;

export type ChartRange = (typeof chartRanges)[number];

export type ChartCandle = {
  close: number;
  datetime: string;
  high: number;
  low: number;
  open: number;
  timestamp: number;
  volume: number | null;
};

type AnalysisCandle = {
  c?: unknown;
  h?: unknown;
  l?: unknown;
  o?: unknown;
  t?: unknown;
  v?: unknown;
};

type AnalysisCandlesResponse = {
  candles?: unknown;
  ticker?: unknown;
  updatedAt?: unknown;
};

type AnalysisCandlesMetaResponse = {
  ticker?: unknown;
  updatedAt?: unknown;
};

type AnalysisSnapshot = {
  dayChange?: unknown;
  dayChangePercent?: unknown;
  lastPrice?: unknown;
  name?: unknown;
  symbol?: unknown;
  updatedAt?: unknown;
};

type AnalysisSnapshotsResponse = {
  snapshots?: unknown;
};

type AnalysisPerformance = {
  performancePercent?: unknown;
  symbol?: unknown;
  updatedAt?: unknown;
};

type AnalysisPerformancesResponse = {
  performances?: unknown;
};

type AnalysisTickersResponse = {
  tickers?: unknown;
};

export type AnalysisAssetSnapshot = {
  dayChange: number | null;
  dayChangePercent: number | null;
  lastPrice: number | null;
  name: string | null;
  symbol: string;
  updatedAt: string | null;
};

export type AnalysisAssetPerformance = {
  performancePercent: number | null;
  symbol: string;
  updatedAt: string | null;
};

type AnalysisDailyChange = {
  dayChange: number | null;
  dayChangePercent: number | null;
  lastPrice: number | null;
};

const emptyDailyChange: AnalysisDailyChange = {
  dayChange: null,
  dayChangePercent: null,
  lastPrice: null,
};

const chartRangeConfig: Record<
  ChartRange,
  {
    interval: string;
  }
> = {
  "1D": {
    interval: "5min",
  },
  "1W": {
    interval: "1h",
  },
  "1M": {
    interval: "1day",
  },
  "3M": {
    interval: "1day",
  },
  "1Y": {
    interval: "1day",
  },
};

// Ticker list changes only after analysis refreshes its daily universe.
let tickerCache:
  | {
      expiresAt: number;
      tickers: string[];
    }
  | null = null;

function getAnalysisUrl(path: string) {
  const analysisUrl = process.env.ANALYSIS_URL;

  if (!analysisUrl) {
    throw new Error("ANALYSIS_URL is not set");
  }

  return new URL(path, analysisUrl);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const numberValue = Number(value);

    return Number.isFinite(numberValue) ? numberValue : null;
  }

  return null;
}

function getTimestamp(datetime: string) {
  // Analysis returns dates for daily candles and ISO-ish datetimes for intraday
  // candles, so normalize both shapes before Date.parse.
  const normalizedDateTime = datetime.includes("T")
    ? datetime
    : datetime.includes(" ")
      ? datetime.replace(" ", "T")
      : `${datetime}T00:00:00Z`;
  const timestamp = Date.parse(normalizedDateTime);

  return Number.isFinite(timestamp) ? timestamp : null;
}

function normalizeAnalysisCandle(value: AnalysisCandle): ChartCandle | null {
  const close = readNumber(value.c);
  const datetime = readString(value.t);
  const high = readNumber(value.h);
  const low = readNumber(value.l);
  const open = readNumber(value.o);

  if (
    close === null ||
    close <= 0 ||
    !datetime ||
    high === null ||
    high <= 0 ||
    low === null ||
    low <= 0 ||
    open === null ||
    open <= 0
  ) {
    return null;
  }

  const timestamp = getTimestamp(datetime);

  if (timestamp === null) {
    return null;
  }

  return {
    close,
    datetime,
    high,
    low,
    open,
    timestamp,
    volume: readNumber(value.v),
  };
}

async function fetchAnalysisJson(
  path: string,
  params?: Record<string, string>
) {
  const url = getAnalysisUrl(path);

  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Analysis request failed with status ${response.status}`);
  }

  return response.json() as Promise<unknown>;
}

async function fetchAnalysisCandlesByParams(
  symbol: string,
  params: Record<string, string>
) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const body = (await fetchAnalysisJson(
    `/candles/${encodeURIComponent(normalizedSymbol)}`,
    params
  )) as AnalysisCandlesResponse;
  const candles = Array.isArray(body.candles)
    ? body.candles
        .map((value) => normalizeAnalysisCandle(value as AnalysisCandle))
        .filter((value): value is ChartCandle => Boolean(value))
        .sort((a, b) => a.timestamp - b.timestamp)
    : [];

  if (candles.length === 0) {
    throw new Error("No analysis candles returned");
  }

  return {
    candles,
    symbol: readString(body.ticker) ?? normalizedSymbol,
    updatedAt: readString(body.updatedAt),
  };
}

async function fetchDailyChange(symbol: string) {
  // Yahoo-style daily movement needs the previous daily close, even when the
  // visible chart uses intraday candles or a longer range window.
  try {
    const [snapshot] = await fetchAnalysisAssetSnapshots([symbol]);

    return snapshot
      ? {
          dayChange: snapshot.dayChange,
          dayChangePercent: snapshot.dayChangePercent,
          lastPrice: snapshot.lastPrice,
        }
      : emptyDailyChange;
  } catch {
    return emptyDailyChange;
  }
}

export async function fetchAnalysisCandles(symbol: string, range: ChartRange) {
  const config = chartRangeConfig[range];
  // The backend owns range windows: 1D maps to 5m, 1W maps to persisted 1h,
  // and longer ranges map to daily candles with the current day updated.
  const data = await fetchAnalysisCandlesByParams(symbol, {
    range,
  });
  const dailyChange = await fetchDailyChange(symbol);

  return {
    candles: data.candles,
    currency: null,
    dayChangePercent: dailyChange.dayChangePercent,
    interval: config.interval,
    lastPrice: dailyChange.lastPrice,
    range,
    source: "Analysis",
    symbol: data.symbol,
    updatedAt: data.updatedAt,
  };
}

export async function fetchAnalysisCandlesMeta(
  symbol: string,
  range: ChartRange
) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const body = (await fetchAnalysisJson(
    `/candles/${encodeURIComponent(normalizedSymbol)}/meta`,
    {
      range,
    }
  )) as AnalysisCandlesMetaResponse;

  return {
    symbol: readString(body.ticker) ?? normalizedSymbol,
    updatedAt: readString(body.updatedAt),
  };
}

function normalizeAnalysisSnapshot(
  value: AnalysisSnapshot
): AnalysisAssetSnapshot | null {
  const symbol = readString(value.symbol);

  if (!symbol) {
    return null;
  }

  return {
    dayChange: readNumber(value.dayChange),
    dayChangePercent: readNumber(value.dayChangePercent),
    lastPrice: readNumber(value.lastPrice),
    name: readString(value.name),
    symbol,
    updatedAt: readString(value.updatedAt),
  };
}

export async function fetchAnalysisAssetSnapshots(
  symbols: string[]
) {
  const normalizedSymbols = symbols
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  if (normalizedSymbols.length === 0) {
    return [];
  }

  const body = (await fetchAnalysisJson(
    "/snapshots",
    {
      symbols: normalizedSymbols.join(","),
    }
  )) as AnalysisSnapshotsResponse;

  return Array.isArray(body.snapshots)
    ? body.snapshots
        .map((value) => normalizeAnalysisSnapshot(value as AnalysisSnapshot))
        .filter((value): value is AnalysisAssetSnapshot => Boolean(value))
    : [];
}

function normalizeAnalysisPerformance(
  value: AnalysisPerformance
): AnalysisAssetPerformance | null {
  const symbol = readString(value.symbol);

  if (!symbol) {
    return null;
  }

  return {
    performancePercent: readNumber(value.performancePercent),
    symbol,
    updatedAt: readString(value.updatedAt),
  };
}

export async function fetchAnalysisAssetPerformances(
  symbols: string[],
  range: ChartRange
) {
  const normalizedSymbols = symbols
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  if (normalizedSymbols.length === 0) {
    return [];
  }

  const body = (await fetchAnalysisJson(
    "/performances",
    {
      range,
      symbols: normalizedSymbols.join(","),
    }
  )) as AnalysisPerformancesResponse;

  return Array.isArray(body.performances)
    ? body.performances
        .map((value) =>
          normalizeAnalysisPerformance(value as AnalysisPerformance)
        )
        .filter((value): value is AnalysisAssetPerformance => Boolean(value))
    : [];
}

export async function fetchAnalysisTickers() {
  const now = Date.now();

  if (tickerCache && tickerCache.expiresAt > now) {
    return tickerCache.tickers;
  }

  const body = (await fetchAnalysisJson("/tickers")) as AnalysisTickersResponse;
  const tickers = Array.isArray(body.tickers)
    ? body.tickers
        .filter((ticker): ticker is string => typeof ticker === "string")
        .map((ticker) => ticker.trim().toUpperCase())
        .filter(Boolean)
    : [];

  tickerCache = {
    expiresAt: now + 12 * 60 * 60 * 1000,
    tickers,
  };

  return tickers;
}

export async function searchAnalysisTickers(query: string, limit = 8) {
  const normalizedQuery = query.trim().toUpperCase();

  if (normalizedQuery.length < 2) {
    return [];
  }

  const tickers = await fetchAnalysisTickers();

  return tickers
    .filter((ticker) => ticker.includes(normalizedQuery))
    .slice(0, limit)
    .map((ticker) => ({
      name: getAssetDisplayName(ticker),
      symbol: ticker,
      type: "Analysis",
    }));
}

export function isChartRange(value: string): value is ChartRange {
  return chartRanges.includes(value as ChartRange);
}
