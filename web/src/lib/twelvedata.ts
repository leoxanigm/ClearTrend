export const chartRanges = ["1D", "1M", "3M", "1Y"] as const;

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

type TwelveDataValue = {
  close?: unknown;
  datetime?: unknown;
  high?: unknown;
  low?: unknown;
  open?: unknown;
  volume?: unknown;
};

type TwelveDataResponse = {
  code?: unknown;
  message?: unknown;
  meta?: {
    currency?: unknown;
    exchange?: unknown;
    interval?: unknown;
    symbol?: unknown;
  };
  status?: unknown;
  values?: unknown;
};

const twelveDataBaseUrl = "https://api.twelvedata.com";

const chartRangeConfig: Record<
  ChartRange,
  {
    cacheTtlMs: number;
    interval: string;
    outputsize: number;
  }
> = {
  "1D": {
    cacheTtlMs: 5 * 60 * 1000,
    interval: "5min",
    outputsize: 78,
  },
  "1M": {
    cacheTtlMs: 30 * 60 * 1000,
    interval: "1day",
    outputsize: 30,
  },
  "3M": {
    cacheTtlMs: 60 * 60 * 1000,
    interval: "1day",
    outputsize: 90,
  },
  "1Y": {
    cacheTtlMs: 6 * 60 * 60 * 1000,
    interval: "1day",
    outputsize: 252,
  },
};

const candleCache = new Map<
  string,
  {
    expiresAt: number;
    value: Awaited<ReturnType<typeof fetchFreshTwelveDataCandles>>;
  }
>();

function getTwelveDataApiKey() {
  return process.env.TWELVEDATA_API_KEY;
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

function parseTimestamp(datetime: string) {
  const normalizedDateTime = datetime.includes(" ")
    ? datetime.replace(" ", "T")
    : `${datetime}T00:00:00`;
  const timestamp = Date.parse(normalizedDateTime);

  return Number.isFinite(timestamp) ? timestamp : null;
}

async function fetchTwelveDataJson(params: Record<string, string>) {
  const apiKey = getTwelveDataApiKey();

  if (!apiKey) {
    throw new Error("TWELVEDATA_API_KEY is not set");
  }

  const url = new URL(`${twelveDataBaseUrl}/time_series`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Twelve Data request failed with status ${response.status}`);
  }

  return response.json() as Promise<TwelveDataResponse>;
}

function normalizeCandle(value: TwelveDataValue): ChartCandle | null {
  const close = readNumber(value.close);
  const datetime = readString(value.datetime);
  const high = readNumber(value.high);
  const low = readNumber(value.low);
  const open = readNumber(value.open);

  if (
    close === null ||
    !datetime ||
    high === null ||
    low === null ||
    open === null
  ) {
    return null;
  }

  const timestamp = parseTimestamp(datetime);

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
    volume: readNumber(value.volume),
  };
}

function normalizeCandles(values: unknown) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => normalizeCandle(value as TwelveDataValue))
    .filter((value): value is ChartCandle => Boolean(value))
    .sort((a, b) => a.timestamp - b.timestamp);
}

async function fetchFreshTwelveDataCandles(symbol: string, range: ChartRange) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const config = chartRangeConfig[range];
  const body = await fetchTwelveDataJson({
    interval: config.interval,
    outputsize: String(config.outputsize),
    symbol: normalizedSymbol,
  });

  if (body.status === "error") {
    throw new Error(readString(body.message) ?? "Twelve Data request failed");
  }

  const candles = normalizeCandles(body.values);

  if (candles.length === 0) {
    throw new Error("No chart data returned");
  }

  return {
    candles,
    currency: readString(body.meta?.currency),
    exchange: readString(body.meta?.exchange),
    interval: readString(body.meta?.interval) ?? config.interval,
    range,
    symbol: readString(body.meta?.symbol) ?? normalizedSymbol,
  };
}

export function isChartRange(value: string): value is ChartRange {
  return chartRanges.includes(value as ChartRange);
}

export async function fetchTwelveDataCandles(symbol: string, range: ChartRange) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const config = chartRangeConfig[range];
  const cacheKey = `${normalizedSymbol}:${range}`;
  const cachedValue = candleCache.get(cacheKey);

  if (cachedValue && cachedValue.expiresAt > Date.now()) {
    return cachedValue.value;
  }

  const freshValue = await fetchFreshTwelveDataCandles(normalizedSymbol, range);

  candleCache.set(cacheKey, {
    expiresAt: Date.now() + config.cacheTtlMs,
    value: freshValue,
  });

  return freshValue;
}
