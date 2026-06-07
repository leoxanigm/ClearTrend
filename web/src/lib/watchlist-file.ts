export const watchlistFileRules = {
  accept: "application/json,.json",
  format: "cleartrend-watchlist",
  maxSize: 64 * 1024,
  maxSymbols: 999,
  version: 1,
};

const symbolPattern = /^[A-Z0-9.-]{1,15}$/;

export type WatchlistFile = {
  exportedAt?: string;
  format: typeof watchlistFileRules.format;
  symbols: string[];
  version: typeof watchlistFileRules.version;
};

export type WatchlistFileValidation = {
  error: string | null;
  invalidEntries: number;
  symbols: string[];
};

export function createWatchlistFile(symbols: string[]): WatchlistFile {
  return {
    exportedAt: new Date().toISOString(),
    format: watchlistFileRules.format,
    symbols,
    version: watchlistFileRules.version,
  };
}

export function validateWatchlistFile(
  value: unknown
): WatchlistFileValidation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      error: "Invalid watchlist JSON structure.",
      invalidEntries: 0,
      symbols: [],
    };
  }

  const payload = value as Record<string, unknown>;

  if (
    payload.format !== watchlistFileRules.format ||
    payload.version !== watchlistFileRules.version ||
    !Array.isArray(payload.symbols)
  ) {
    return {
      error: "Unsupported watchlist JSON format or version.",
      invalidEntries: 0,
      symbols: [],
    };
  }

  if (payload.symbols.length > watchlistFileRules.maxSymbols) {
    return {
      error: `A watchlist file can contain at most ${watchlistFileRules.maxSymbols} symbols.`,
      invalidEntries: 0,
      symbols: [],
    };
  }

  const normalized = payload.symbols.map((symbol) =>
    typeof symbol === "string" ? symbol.trim().toUpperCase() : null
  );
  const symbols = Array.from(
    new Set(
      normalized.filter(
        (symbol): symbol is string =>
          Boolean(symbol) && symbolPattern.test(symbol as string)
      )
    )
  );
  const invalidEntries = normalized.filter(
    (symbol) => !symbol || !symbolPattern.test(symbol)
  ).length;

  if (symbols.length === 0) {
    return {
      error: "The watchlist file does not contain any valid symbol.",
      invalidEntries,
      symbols: [],
    };
  }

  return {
    error: null,
    invalidEntries,
    symbols,
  };
}
