import { getAssetDisplayName } from "@/lib/asset-labels";

// Server-side adapter between the FastAPI analysis service and the Next.js
// routes consumed by the dashboard. This module validates every external value
// before exposing a stable, frontend-friendly contract.
export const chartRanges = ["1D", "1W", "1M", "3M", "1Y"] as const;

// The union is derived from chartRanges so runtime validation and TypeScript
// always accept the same set of ranges.
export type ChartRange = (typeof chartRanges)[number];

// Complete candle shape expected by AssetChart after API normalization.
export type ChartCandle = {
  close: number;
  datetime: string;
  high: number;
  low: number;
  open: number;
  timestamp: number;
  volume: number | null;
};

// Raw FastAPI transport types intentionally use unknown. A successful HTTP
// response does not guarantee that each JSON property has the expected type.
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
  interval?: unknown;
  ticker?: unknown;
  updatedAt?: unknown;
};

type AnalysisCandlesMetaResponse = {
  interval?: unknown;
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

// Public snapshot contracts are safe for React components: identifiers are
// guaranteed, while genuinely unavailable market values remain nullable.
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

// The ticker universe changes rarely, so a dedicated long-lived cache avoids
// reading the same complete list for every search input.
let tickerCache:
  | {
      expiresAt: number;
      tickers: string[];
  }
  | null = null;

// Watchlist requests are intentionally bounded. Each HTTP call carries at most
// 20 symbols and only two calls run together, limiting FastAPI and disk load.
const analysisBatchSize = 20;
const analysisBatchConcurrency = 2;
const analysisBatchCacheMs = 30 * 1000;
const analysisBatchTimeoutMs = 15 * 1000;

// Short response cache shared by server-side Next.js requests. The in-flight
// map is separate: it deduplicates simultaneous requests even when cacheMs is 0.
const analysisJsonCache = new Map<
  string,
  { expiresAt: number; value: unknown }
>();
const analysisJsonInFlight = new Map<string, Promise<unknown>>();

/**
 * Resolve a FastAPI endpoint against the internal Docker service URL.
 *
 * ANALYSIS_URL normally points to http://analysis:8000 and is never exposed to
 * the browser because this function only runs in Next.js server code.
 */
function getAnalysisUrl(path: string) {
  const analysisUrl = process.env.ANALYSIS_URL;

  if (!analysisUrl) {
    throw new Error("ANALYSIS_URL is not set");
  }

  return new URL(path, analysisUrl);
}

// Runtime readers form the first validation layer. Invalid values become null
// instead of propagating NaN, empty identifiers, or unexpected JSON types.
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

/**
 * Convert the date formats emitted by FastAPI into milliseconds since epoch.
 *
 * Daily candles only contain a date, while intraday candles contain a date and
 * time. Adding UTC midnight to a date-only value makes parsing deterministic.
 */
function getTimestamp(datetime: string) {
  const normalizedDateTime = datetime.includes("T")
    ? datetime
    : datetime.includes(" ")
      ? datetime.replace(" ", "T")
      : `${datetime}T00:00:00Z`;
  const timestamp = Date.parse(normalizedDateTime);

  return Number.isFinite(timestamp) ? timestamp : null;
}

/**
 * Convert compact FastAPI keys (t, o, h, l, c, v) into a ChartCandle.
 *
 * A malformed OHLC value invalidates the entire candle because it cannot be
 * drawn reliably. Volume is optional because some providers omit it.
 */
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
    // Reject incomplete or non-positive price data before chart calculations.
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

/**
 * Fetch JSON from FastAPI with a timeout and optional short-lived cache.
 *
 * Requests are keyed by their complete URL, including query parameters. Two
 * callers requesting the same URL concurrently await the same Promise.
 */
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

  // Return a completed response while its caller-defined TTL is still valid.
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
    // no-store prevents Next.js from adding another implicit cache layer. Cache
    // lifetime remains explicit and local to this adapter.
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

    // Candle requests normally skip this cache; watchlist batches use 30 seconds.
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
    // A failed request must also leave the map, otherwise later calls would
    // remain attached to an already rejected Promise.
    analysisJsonInFlight.delete(cacheKey);
  }
}

/** Split a large watchlist into predictable query and processing units. */
function splitIntoBatches<T>(values: T[], batchSize: number) {
  const batches: T[][] = [];

  for (let index = 0; index < values.length; index += batchSize) {
    batches.push(values.slice(index, index + batchSize));
  }

  return batches;
}

/**
 * Process watchlist batches with bounded concurrency.
 *
 * Promise.allSettled deliberately preserves successful batches if one request
 * times out. The UI can therefore show partial market data instead of failing
 * the complete watchlist.
 */
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

    // Rejected groups are omitted; callers later provide explicit null
    // placeholders where preserving the requested symbol order matters.
    for (const result of groupResults) {
      if (result.status === "fulfilled") {
        values.push(...result.value);
      }
    }
  }

  return values;
}

/**
 * Load one chart series, normalize every candle, and order it chronologically.
 */
async function fetchAnalysisCandlesByParams(
  symbol: string,
  params: Record<string, string>
) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const body = (await fetchAnalysisJson(
    `/candles/${encodeURIComponent(normalizedSymbol)}`,
    params
  )) as AnalysisCandlesResponse;

  // Bad individual rows are discarded. A completely unusable response remains
  // an error so the route can report that the chart is unavailable.
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
    interval: readString(body.interval),
    symbol: readString(body.ticker) ?? normalizedSymbol,
    updatedAt: readString(body.updatedAt),
  };
}

/**
 * Read the latest price and daily variation independently from chart candles.
 */
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

/**
 * Return all information required to render one selected chart range.
 */
export async function fetchAnalysisCandles(symbol: string, range: ChartRange) {
  // The backend owns range windows and cache selection. The frontend only sends
  // the semantic range selected by the user, then displays the actual interval
  // returned by FastAPI.
  const data = await fetchAnalysisCandlesByParams(symbol, {
    range,
  });
  const dailyChange = await fetchDailyChange(symbol);

  return {
    candles: data.candles,
    currency: null,
    dayChangePercent: dailyChange.dayChangePercent,
    interval: data.interval,
    lastPrice: dailyChange.lastPrice,
    range,
    source: "Analysis",
    symbol: data.symbol,
    updatedAt: data.updatedAt,
  };
}

/**
 * Read only cache freshness metadata for lightweight browser polling.
 *
 * AssetChart compares updatedAt and interval before downloading the complete
 * OHLCV series.
 */
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
    interval: readString(body.interval),
    symbol: readString(body.ticker) ?? normalizedSymbol,
    updatedAt: readString(body.updatedAt),
  };
}

/** Normalize one watchlist snapshot returned by FastAPI. */
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

/**
 * Load latest price snapshots for a potentially large set of watchlist assets.
 */
export async function fetchAnalysisAssetSnapshots(
  symbols: string[]
) {
  // Normalize and deduplicate before batching so aliases such as " aapl " and
  // "AAPL" cannot generate duplicate upstream work.
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

  // Sorting creates stable URLs, which improves cache hits across users whose
  // watchlists contain the same symbols in a different order.
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

/** Normalize one first-to-last close performance returned by FastAPI. */
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

/**
 * Load percentage performances for the range selected in the watchlist.
 */
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

  // Restore the caller's requested order and represent missing batches/data as
  // null rather than silently removing assets from the watchlist.
  return normalizedSymbols.map(
    (symbol) =>
      performanceBySymbol.get(symbol) ?? {
        performancePercent: null,
        symbol,
        updatedAt: null,
      }
  );
}

/**
 * Load and cache the searchable symbol universe exposed by FastAPI.
 */
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

  // Twelve hours is acceptable because the source universe is rebuilt by the
  // analysis service, not by individual user searches.
  tickerCache = {
    expiresAt: now + 12 * 60 * 60 * 1000,
    tickers,
  };

  return tickers;
}

/**
 * Perform a lightweight local symbol search over the cached ticker universe.
 */
export async function searchAnalysisTickers(query: string, limit = 8) {
  const normalizedQuery = query.trim().toUpperCase();

  if (normalizedQuery.length < 2) {
    return [];
  }

  const tickers = await fetchAnalysisTickers();

  // Display names are resolved locally after symbol matching; no provider call
  // is triggered while the user types.
  return tickers
    .filter((ticker) => ticker.includes(normalizedQuery))
    .slice(0, limit)
    .map((ticker) => ({
      name: getAssetDisplayName(ticker),
      symbol: ticker,
      type: "Analysis",
    }));
}

/** Runtime type guard used for URL and API query parameters. */
export function isChartRange(value: string): value is ChartRange {
  return chartRanges.includes(value as ChartRange);
}
