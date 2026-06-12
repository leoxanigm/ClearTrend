// Public contract shared by browser preview, API validation, and JSON export.
export const watchlistFileRules = {
  accept: "application/json,.json",
  format: "cleartrend-watchlist",
  maxSize: 64 * 1024,
  maxSymbols: 999,
  version: 1,
};

// Symbols use the same conservative character set as the application's watchlist.
const symbolPattern = /^[A-Z0-9.=-]{1,15}$/;

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

// Build the versioned document returned by the authenticated export endpoint.
export function createWatchlistFile(symbols: string[]): WatchlistFile {
  return {
    exportedAt: new Date().toISOString(),
    format: watchlistFileRules.format,
    symbols,
    version: watchlistFileRules.version,
  };
}

// Validate unknown parsed JSON and return normalized symbols plus ignored counts.
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

  // Format and version prevent unrelated JSON documents from being imported.
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

  // Reject oversized arrays before normalization to keep processing bounded.
  if (payload.symbols.length > watchlistFileRules.maxSymbols) {
    return {
      error: `A watchlist file can contain at most ${watchlistFileRules.maxSymbols} symbols.`,
      invalidEntries: 0,
      symbols: [],
    };
  }

  // Normalize case, remove duplicates, and retain only syntactically valid symbols.
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

  // A structurally valid document still needs at least one usable symbol.
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
