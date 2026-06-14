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

// Public types below are normalized contracts safe for React components.
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

const analysisBatchSize = 20;
const analysisBatchConcurrency = 2;
const analysisBatchCacheMs = 30 * 1000;
const analysisBatchTimeoutMs = 15 * 1000;
const analysisJsonCache = new Map<
  string,
  { expiresAt: number; value: unknown }
>();
const analysisJsonInFlight = new Map<string, Promise<unknown>>();

// Resolve every internal analysis request from the Docker service base URL.
function getAnalysisUrl(path: string) {
  const analysisUrl = process.env.ANALYSIS_URL;

  if (!analysisUrl) {
    throw new Error("ANALYSIS_URL is not set");
  }

  return new URL(path, analysisUrl);
}

// Runtime readers reject malformed provider values before they enter UI state.
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

// Convert the compact FastAPI OHLCV shape into the frontend candle contract.
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

// Shared internal fetcher provides timeouts, short caching, and in-flight deduplication.
async function fetchAnalysisJson(
  path: string,
  params?: Record<string, string>,
  options: {
    cacheMs?: number;
    timeoutMs?: number;
  } = {}
) {
  const url = getAnalysisUrl(path);

  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value);
  }

  const cacheKey = url.toString();
  const cached = analysisJsonCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  if (cached) {
    analysisJsonCache.delete(cacheKey);
  }

  const inFlight = analysisJsonInFlight.get(cacheKey);

  if (inFlight) {
    // Concurrent users asking for the same resource share one upstream request.
    return inFlight;
  }

  const request = (async () => {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
    });

    if (!response.ok) {
      throw new Error(
        `Analysis request failed with status ${response.status}`
      );
    }

    const value = await response.json() as unknown;

    if ((options.cacheMs ?? 0) > 0) {
      analysisJsonCache.set(cacheKey, {
        expiresAt: Date.now() + (options.cacheMs ?? 0),
        value,
      });
    }

    return value;
  })();

  analysisJsonInFlight.set(cacheKey, request);

  try {
    return await request;
  } finally {
    analysisJsonInFlight.delete(cacheKey);
  }
}

// Large watchlists are split to keep query strings and analysis work bounded.
function splitIntoBatches<T>(values: T[], batchSize: number) {
  const batches: T[][] = [];

  for (let index = 0; index < values.length; index += batchSize) {
    batches.push(values.slice(index, index + batchSize));
  }

  return batches;
}

// Process a small number of batches concurrently and keep successful partial results.
async function loadAnalysisInBatches<T>(
  symbols: string[],
  loader: (batchSymbols: string[]) => Promise<T[]>
) {
  const batches = splitIntoBatches(symbols, analysisBatchSize);
  const values: T[] = [];

  for (
    let index = 0;
    index < batches.length;
    index += analysisBatchConcurrency
  ) {
    const batchGroup = batches.slice(
      index,
      index + analysisBatchConcurrency
    );
    const groupResults = await Promise.allSettled(
      batchGroup.map((batch) =>
        loader(batch)
      )
    );

    for (const result of groupResults) {
      if (result.status === "fulfilled") {
        values.push(...result.value);
      }
    }
  }

  return values;
}

// Load, normalize, sort, and reject an unusable candle response.
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

// Metadata requests support lightweight browser polling without OHLCV transfer.
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
  const normalizedSymbols = Array.from(
    new Set(
      symbols
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean)
    )
  );

  if (normalizedSymbols.length === 0) {
    return [];
  }

  return loadAnalysisInBatches(
    [...normalizedSymbols].sort(),
    async (batchSymbols) => {
      const body = (await fetchAnalysisJson(
        "/snapshots",
        {
          symbols: batchSymbols.join(","),
        },
        {
          cacheMs: analysisBatchCacheMs,
          timeoutMs: analysisBatchTimeoutMs,
        },
      )) as AnalysisSnapshotsResponse;

      return Array.isArray(body.snapshots)
        ? body.snapshots
            .map((value) =>
              normalizeAnalysisSnapshot(value as AnalysisSnapshot)
            )
            .filter(
              (value): value is AnalysisAssetSnapshot => Boolean(value)
            )
        : [];
    }
  );
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
  const normalizedSymbols = Array.from(
    new Set(
      symbols
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean)
    )
  );

  if (normalizedSymbols.length === 0) {
    return [];
  }

  const performances = await loadAnalysisInBatches(
    [...normalizedSymbols].sort(),
    async (batchSymbols) => {
      const body = (await fetchAnalysisJson(
        "/performances",
        {
          range,
          symbols: batchSymbols.join(","),
        },
        {
          cacheMs: analysisBatchCacheMs,
          timeoutMs: analysisBatchTimeoutMs,
        },
      )) as AnalysisPerformancesResponse;

      return Array.isArray(body.performances)
        ? body.performances
            .map((value) =>
              normalizeAnalysisPerformance(value as AnalysisPerformance)
            )
            .filter(
              (value): value is AnalysisAssetPerformance => Boolean(value)
            )
        : [];
    }
  );
  const performanceBySymbol = new Map(
    performances.map((performance) => [
      performance.symbol,
      performance,
    ])
  );

  return normalizedSymbols.map(
    (symbol) =>
      performanceBySymbol.get(symbol) ?? {
        performancePercent: null,
        symbol,
        updatedAt: null,
      }
  );
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
