import { fetchFinnhubAsset } from "@/lib/finnhub";
import { wasAttemptedRecently } from "@/lib/external-data";
import { getPrisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

/* ADD WATCHLIST SYMBOLS HERE */
export const defaultWatchlistSymbols = [ // list of 150 main assets of S&P500
  "AAPL",
  "MSFT",
  "NVDA",
  "TSLA",
  "AMD",
  "FAKE-TEST", // Fake one for testing
  "GOOGL",
  "AMZN",
  "META",
  "NFLX",
  "INTC",
  "ORCL",
  "CRM",
  "ADBE",
  "PYPL",
  "UBER",
  "SHOP",
  "COIN",
  "PLTR",
  "SMCI",
  "AVGO",
  "QCOM",
  "MU",
  "JPM",
  "BAC",
  "V",
  "MA",
  "DIS",
  "NKE",
  "WMT",
  "COST",
  "LLY",
  "UNH",
  "XOM",
  "HD",
  "PG",
  "JNJ",
  "MRK",
  "ABBV",
  "CVX",
  "PEP",
  "KO",
  "TMO",
  "MCD",
  "CSCO",
  "PFE",
  "ABT",
  "LIN",
  "NEE",
  "DHR",
  "WFC",
  "TXN",
  "PM",
  "MS",
  "VZ",
  "RTX",
  "AMAT",
  "INTU",
  "BKNG",
  "GS",
  "LOW",
  "SPGI",
  "SYK",
  "HON",
  "ELV",
  "T",
  "LRCX",
  "BLK",
  "BA",
  "ETN",
  "TJX",
  "C",
  "REGN",
  "VRTX",
  "PGR",
  "CB",
  "BSX",
  "ADI",
  "MDLZ",
  "LMT",
  "PANW",
  "DE",
  "SCHW",
  "CI",
  "GILD",
  "SNPS",
  "IBM",
  "ZTS",
  "CDNS",
  "KLAC",
  "CVS",
  "ICE",
  "WM",
  "MAR",
  "HCA",
  "MO",
  "SHW",
  "ITW",
  "APH",
  "EOG",
  "NXPI",
  "GD",
  "MCK",
  "EMR",
  "BDX",
  "CMG",
  "MCO",
  "PH",
  "USB",
  "ECL",
  "WELL",
  "ORLY",
  "ROP",
  "AMGN",
  "AMP",
  "AMT",
  "ANET",
  "AON",
  "APA",
  "APD",
  "ARE",
  "ATO",
  "AVB",
  "AWK",
  "AXP",
  "AYI",
  "AZO",
  "CAT",
  "GE",
  "MMM",
  "TGT",
  "FDX",
  "DELL",
  "MSTR",
  "RIVN",
  "SNOW",
  "MDT",
  "ISRG",
  "NOW",
  "SBUX",
  "GME",
  "LULU",
  "PINS",
  "TWLO",
  "BINANCE:BTCUSDT",
  "BINANCE:ETHUSDT",
  "BINANCE:SOLUSDT",
  "BINANCE:BNBUSDT",
  "BINANCE:ADAUSDT",
  "BINANCE:XRPUSDT",
  "BINANCE:DOTUSDT",
  "BINANCE:LINKUSDT",
  "BINANCE:DOGEUSDT",
  "BINANCE:AVAXUSDT"
];

const assetCacheTtlMs = 5 * 60 * 1000;  // Time keeping asset in cache = 5 min
/*
  FINHUB LIMITS : 
    - 60 calls / min  => 86 400 call max / day
    - actually 2 calls by refresh -> 1 call for profil (need just once), 1 for quote
    - 1 asset = 288 + 1 calls/day
    - 10 assets = 2 888 + 10 calls/days
    - 150 assets = 43 200 call still
*/
const symbolPattern = /^[A-Z0-9.-]{1,15}$/;

export type WatchlistAsset = {
  dayChangePercent: number | null;
  isFavorite: boolean;
  isStale: boolean;
  lastPrice: number | null;
  name: string;
  symbol: string;
};

type StoredAsset = {
  dataFetchedAt: Date | null;
  dayChangePercent: number | null;
  fetchAttemptedAt: Date | null;
  lastPrice: number | null;
  name: string | null;
  symbol: string;
  updatedAt: Date;
};

type FavoriteSymbolsRow = {
  favoriteSymbols: string[] | null;
};

export function normalizeWatchlistSymbols(symbols: string[]) {
  return Array.from(
    new Set(
      symbols
        .map((symbol) => symbol.trim().toUpperCase())
        .filter((symbol) => symbolPattern.test(symbol))
    )
  ).slice(0, 999); // number of assets on the left bar
}

export function parseWatchlistSymbols(value: string | null) {
  if (!value) {
    return defaultWatchlistSymbols;
  }

  const symbols = normalizeWatchlistSymbols(value.split(","));

  return symbols.length > 0 ? symbols : defaultWatchlistSymbols;
}

function toWatchlistAsset(
  asset: {
    dayChangePercent: number | null;
    lastPrice: number | null;
    name: string | null;
    symbol: string;
  },
  isStale = false
): WatchlistAsset {
  return {
    dayChangePercent: asset.dayChangePercent,
    isFavorite: false,
    isStale,
    lastPrice: asset.lastPrice,
    name: asset.name ?? asset.symbol,
    symbol: asset.symbol,
  };
}

function fallbackAsset(symbol: string): WatchlistAsset {
  return {
    dayChangePercent: null,
    isFavorite: false,
    isStale: true,
    lastPrice: null,
    name: symbol,
    symbol,
  };
}

export async function getUserFavoriteSymbols(userId: string) {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<FavoriteSymbolsRow[]>`
    SELECT "favoriteSymbols"
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  return normalizeWatchlistSymbols(rows[0]?.favoriteSymbols ?? []);
}

export async function setUserFavoriteSymbol(
  userId: string,
  symbol: string,
  isFavorite: boolean
) {
  const [normalizedSymbol] = normalizeWatchlistSymbols([symbol]);

  if (!normalizedSymbol) {
    return [];
  }

  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<FavoriteSymbolsRow[]>`
    UPDATE users
    SET
      "favoriteSymbols" = CASE
        WHEN ${isFavorite} THEN
          CASE
            WHEN ${normalizedSymbol} = ANY(COALESCE("favoriteSymbols", ARRAY[]::text[]))
              THEN COALESCE("favoriteSymbols", ARRAY[]::text[])
            ELSE array_append(COALESCE("favoriteSymbols", ARRAY[]::text[]), ${normalizedSymbol})
          END
        ELSE array_remove(COALESCE("favoriteSymbols", ARRAY[]::text[]), ${normalizedSymbol})
      END,
      "updatedAt" = now()
    WHERE id = ${userId}
    RETURNING "favoriteSymbols"
  `;

  return normalizeWatchlistSymbols(rows[0]?.favoriteSymbols ?? []);
}

function isFresh(asset: StoredAsset) {
  return Boolean(
    asset.dataFetchedAt &&
      Date.now() - asset.dataFetchedAt.getTime() < assetCacheTtlMs
  );
}

function wasRecentlyAttempted(asset: StoredAsset) {
  return wasAttemptedRecently(asset.fetchAttemptedAt);
}

async function findStoredAsset(symbol: string) {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<StoredAsset[]>`
    SELECT
      symbol,
      name,
      "lastPrice",
      "dayChangePercent",
      "dataFetchedAt",
      "fetchAttemptedAt",
      "updatedAt"
    FROM assets
    WHERE symbol = ${symbol}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function markAssetFetchAttempt(symbol: string) {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<StoredAsset[]>`
    INSERT INTO assets (
      id,
      symbol,
      "fetchAttemptedAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${symbol},
      now(),
      now(),
      now()
    )
    ON CONFLICT (symbol) DO UPDATE SET
      "fetchAttemptedAt" = now()
    RETURNING
      symbol,
      name,
      "lastPrice",
      "dayChangePercent",
      "dataFetchedAt",
      "fetchAttemptedAt",
      "updatedAt"
  `;

  return rows[0] ?? null;
}

async function upsertStoredAsset(asset: Awaited<ReturnType<typeof fetchFinnhubAsset>>) {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<StoredAsset[]>`
    INSERT INTO assets (
      id,
      symbol,
      "displaySymbol",
      name,
      description,
      type,
      exchange,
      mic,
      currency,
      country,
      industry,
      "logoUrl",
      "webUrl",
      "ipoDate",
      "marketCap",
      "shareOutstanding",
      figi,
      "lastPrice",
      "dayChange",
      "dayChangePercent",
      "dayHigh",
      "dayLow",
      "dayOpen",
      "previousClose",
      "quoteTimestamp",
      "dataFetchedAt",
      "fetchAttemptedAt",
      "rawProfile",
      "rawQuote",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${asset.symbol},
      ${asset.displaySymbol},
      ${asset.name},
      ${asset.description},
      ${asset.type},
      ${asset.exchange},
      ${asset.mic},
      ${asset.currency},
      ${asset.country},
      ${asset.industry},
      ${asset.logoUrl},
      ${asset.webUrl},
      ${asset.ipoDate},
      ${asset.marketCap},
      ${asset.shareOutstanding},
      ${asset.figi},
      ${asset.lastPrice},
      ${asset.dayChange},
      ${asset.dayChangePercent},
      ${asset.dayHigh},
      ${asset.dayLow},
      ${asset.dayOpen},
      ${asset.previousClose},
      ${asset.quoteTimestamp},
      now(),
      now(),
      ${JSON.stringify(asset.rawProfile)}::jsonb,
      ${JSON.stringify(asset.rawQuote)}::jsonb,
      now(),
      now()
    )
    ON CONFLICT (symbol) DO UPDATE SET
      "displaySymbol" = EXCLUDED."displaySymbol",
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      type = EXCLUDED.type,
      exchange = EXCLUDED.exchange,
      mic = EXCLUDED.mic,
      currency = EXCLUDED.currency,
      country = EXCLUDED.country,
      industry = EXCLUDED.industry,
      "logoUrl" = EXCLUDED."logoUrl",
      "webUrl" = EXCLUDED."webUrl",
      "ipoDate" = EXCLUDED."ipoDate",
      "marketCap" = EXCLUDED."marketCap",
      "shareOutstanding" = EXCLUDED."shareOutstanding",
      figi = EXCLUDED.figi,
      "lastPrice" = EXCLUDED."lastPrice",
      "dayChange" = EXCLUDED."dayChange",
      "dayChangePercent" = EXCLUDED."dayChangePercent",
      "dayHigh" = EXCLUDED."dayHigh",
      "dayLow" = EXCLUDED."dayLow",
      "dayOpen" = EXCLUDED."dayOpen",
      "previousClose" = EXCLUDED."previousClose",
      "quoteTimestamp" = EXCLUDED."quoteTimestamp",
      "dataFetchedAt" = now(),
      "fetchAttemptedAt" = now(),
      "rawProfile" = EXCLUDED."rawProfile",
      "rawQuote" = EXCLUDED."rawQuote",
      "updatedAt" = now()
    RETURNING
      symbol,
      name,
      "lastPrice",
      "dayChangePercent",
      "dataFetchedAt",
      "fetchAttemptedAt",
      "updatedAt"
  `;

  return rows[0];
}

async function getOrSyncAsset(symbol: string) {
  const existingAsset = await findStoredAsset(symbol);

  if (existingAsset && isFresh(existingAsset)) {
    return toWatchlistAsset(existingAsset);
  }

  if (existingAsset && wasRecentlyAttempted(existingAsset)) {
    return toWatchlistAsset(existingAsset, true);
  }

  await markAssetFetchAttempt(symbol);

  try {
    const asset = await fetchFinnhubAsset(symbol);
    const savedAsset = await upsertStoredAsset(asset);

    return toWatchlistAsset(savedAsset);
  } catch {
    if (existingAsset) {
      return toWatchlistAsset(existingAsset, true);
    }

    return fallbackAsset(symbol);
  }
}

export async function getWatchlistAssets(symbols = defaultWatchlistSymbols) {
  const normalizedSymbols = normalizeWatchlistSymbols(symbols);

  return Promise.all(normalizedSymbols.map((symbol) => getOrSyncAsset(symbol)));
}

export async function getUserWatchlistAssets(
  userId: string,
  symbols = defaultWatchlistSymbols,
  options: { includeSavedFavorites?: boolean } = {}
) {
  const favoriteSymbols = await getUserFavoriteSymbols(userId);
  const symbolsToLoad =
    options.includeSavedFavorites === false
      ? normalizeWatchlistSymbols(symbols)
      : normalizeWatchlistSymbols([...favoriteSymbols, ...symbols]);
  const favoriteSet = new Set(favoriteSymbols);
  const assets = await getWatchlistAssets(symbolsToLoad);

  return assets.map((asset) => ({
    ...asset,
    isFavorite: favoriteSet.has(asset.symbol),
  }));
}
