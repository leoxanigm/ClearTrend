type FinnhubProfile = Record<string, unknown>;
type FinnhubQuote = Record<string, unknown>;
type FinnhubSearchResult = {
  description?: unknown;
  displaySymbol?: unknown;
  symbol?: unknown;
  type?: unknown;
};

const finnhubBaseUrl = "https://finnhub.io/api/v1";

function getFinnhubApiKey() {
  return process.env.FINNHUB_API_KEY;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function fetchFinnhubJson(path: string, params: Record<string, string>) {
  const apiKey = getFinnhubApiKey();

  if (!apiKey) {
    throw new Error("FINNHUB_API_KEY is not set");
  }

  const url = new URL(`${finnhubBaseUrl}${path}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  url.searchParams.set("token", apiKey);

  const response = await fetch(url, {
    next: {
      revalidate: 60,
    },
  });

  if (!response.ok) {
    throw new Error(`Finnhub request failed with status ${response.status}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

function normalizeFinnhubQuote(symbol: string, quote: FinnhubQuote) {
  const quoteTimestamp = readNumber(quote.t);

  return {
    dayChange: readNumber(quote.d),
    dayChangePercent: readNumber(quote.dp),
    dayHigh: readNumber(quote.h),
    dayLow: readNumber(quote.l),
    dayOpen: readNumber(quote.o),
    lastPrice: readNumber(quote.c),
    previousClose: readNumber(quote.pc),
    quoteTimestamp: quoteTimestamp ? new Date(quoteTimestamp * 1000) : null,
    rawQuote: quote,
    symbol,
  };
}

export async function fetchFinnhubQuote(symbol: string) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const quote = (await fetchFinnhubJson("/quote", {
    symbol: normalizedSymbol,
  })) as FinnhubQuote;

  return normalizeFinnhubQuote(normalizedSymbol, quote);
}

export async function searchFinnhubAssets(query: string) {
  const normalizedQuery = query.trim();

  if (normalizedQuery.length < 2) {
    return [];
  }

  const body = await fetchFinnhubJson("/search", {
    q: normalizedQuery,
  });
  const results = Array.isArray(body.result)
    ? (body.result as FinnhubSearchResult[])
    : [];

  return results
    .map((result) => ({
      description: readString(result.description),
      displaySymbol: readString(result.displaySymbol),
      symbol: readString(result.symbol),
      type: readString(result.type),
    }))
    .filter((result) => result.symbol && result.description)
    .slice(0, 8);
}

export async function fetchFinnhubAsset(symbol: string) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const [profile, quote] = await Promise.all([
    fetchFinnhubJson("/stock/profile2", {
      symbol: normalizedSymbol,
    }) as Promise<FinnhubProfile>,
    fetchFinnhubJson("/quote", {
      symbol: normalizedSymbol,
    }) as Promise<FinnhubQuote>,
  ]);
  const normalizedQuote = normalizeFinnhubQuote(normalizedSymbol, quote);

  return {
    country: readString(profile.country),
    currency: readString(profile.currency),
    dayChange: normalizedQuote.dayChange,
    dayChangePercent: normalizedQuote.dayChangePercent,
    dayHigh: normalizedQuote.dayHigh,
    dayLow: normalizedQuote.dayLow,
    dayOpen: normalizedQuote.dayOpen,
    description: readString(profile.name),
    displaySymbol: readString(profile.ticker) ?? normalizedSymbol,
    exchange: readString(profile.exchange),
    figi: readString(profile.figi),
    industry: readString(profile.finnhubIndustry),
    ipoDate: readString(profile.ipo),
    lastPrice: normalizedQuote.lastPrice,
    logoUrl: readString(profile.logo),
    marketCap: readNumber(profile.marketCapitalization),
    mic: null,
    name: readString(profile.name),
    previousClose: normalizedQuote.previousClose,
    quoteTimestamp: normalizedQuote.quoteTimestamp,
    rawProfile: profile,
    rawQuote: normalizedQuote.rawQuote,
    shareOutstanding: readNumber(profile.shareOutstanding),
    symbol: normalizedSymbol,
    type: "Stock",
    webUrl: readString(profile.weburl),
  };
}
