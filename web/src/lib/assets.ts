import {
  fetchAnalysisAssetSnapshots,
  type AnalysisAssetSnapshot,
} from "@/lib/analysis-data";
import { getAssetDisplayName } from "@/lib/asset-labels";
import { defaultWatchlistSymbols } from "@/lib/asset-symbols";
import { getPrisma } from "@/lib/prisma";

const symbolPattern = /^[A-Z0-9.-]{1,15}$/;

export type WatchlistAsset = {
  dayChangePercent: number | null;
  isFavorite: boolean;
  isStale: boolean;
  lastPrice: number | null;
  name: string;
  symbol: string;
};

type FavoriteSymbolsRow = {
  favoriteSymbols: string[] | null;
};

type WatchlistLoadOptions = {
  includeSavedFavorites?: boolean;
  loadSnapshots?: boolean;
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
  asset: AnalysisAssetSnapshot
): WatchlistAsset {
  return {
    dayChangePercent: asset.dayChangePercent,
    isFavorite: false,
    isStale: false,
    lastPrice: asset.lastPrice,
    name: getAssetDisplayName(asset.symbol, asset.name),
    symbol: asset.symbol,
  };
}

function fallbackAsset(symbol: string): WatchlistAsset {
  return {
    dayChangePercent: null,
    isFavorite: false,
    isStale: true,
    lastPrice: null,
    name: getAssetDisplayName(symbol),
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

export async function getWatchlistAssets(
  symbols = defaultWatchlistSymbols,
  options: { loadSnapshots?: boolean } = {}
) {
  const normalizedSymbols = normalizeWatchlistSymbols(symbols);

  if (options.loadSnapshots === false) {
    return normalizedSymbols.map(fallbackAsset);
  }

  try {
    const snapshots = await fetchAnalysisAssetSnapshots(normalizedSymbols);
    const snapshotBySymbol = new Map(
      snapshots.map((snapshot) => [snapshot.symbol, snapshot])
    );

    return normalizedSymbols.map((symbol) => {
      const snapshot = snapshotBySymbol.get(symbol);

      return snapshot ? toWatchlistAsset(snapshot) : fallbackAsset(symbol);
    });
  } catch {
    return normalizedSymbols.map(fallbackAsset);
  }
}

export async function getUserWatchlistAssets(
  userId: string,
  symbols = defaultWatchlistSymbols,
  options: WatchlistLoadOptions = {}
) {
  const favoriteSymbols = await getUserFavoriteSymbols(userId);
  const symbolsToLoad =
    options.includeSavedFavorites === false
      ? normalizeWatchlistSymbols(symbols)
      : normalizeWatchlistSymbols([...favoriteSymbols, ...symbols]);
  const favoriteSet = new Set(favoriteSymbols);
  const assets = await getWatchlistAssets(symbolsToLoad, {
    loadSnapshots: options.loadSnapshots,
  });

  return assets.map((asset) => ({
    ...asset,
    isFavorite: favoriteSet.has(asset.symbol),
  }));
}
