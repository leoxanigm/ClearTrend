const knownAssetNames: Record<string, string> = {
  AAPL: "Apple Inc.",
  ABBV: "AbbVie Inc.",
  ABT: "Abbott Laboratories",
  ADBE: "Adobe Inc.",
  ADI: "Analog Devices, Inc.",
  AMD: "Advanced Micro Devices, Inc.",
  AMGN: "Amgen Inc.",
  AMAT: "Applied Materials, Inc.",
  AMZN: "Amazon.com, Inc.",
  ANET: "Arista Networks, Inc.",
  AVGO: "Broadcom Inc.",
  BAC: "Bank of America Corporation",
  BKNG: "Booking Holdings Inc.",
  BLK: "BlackRock, Inc.",
  BSX: "Boston Scientific Corporation",
  CAT: "Caterpillar Inc.",
  CDNS: "Cadence Design Systems, Inc.",
  COST: "Costco Wholesale Corporation",
  CRM: "Salesforce, Inc.",
  CSCO: "Cisco Systems, Inc.",
  CVX: "Chevron Corporation",
  DE: "Deere & Company",
  DELL: "Dell Technologies Inc.",
  DIS: "The Walt Disney Company",
  "BTC-USD": "Bitcoin",
  "ETH-USD": "Ethereum",
  "GC=F": "Gold Futures",
  GOOGL: "Alphabet Inc.",
  GSPC: "S&P 500 Index",
  HD: "The Home Depot, Inc.",
  IBM: "International Business Machines Corporation",
  INTC: "Intel Corporation",
  IXIC: "Nasdaq Composite",
  ISRG: "Intuitive Surgical, Inc.",
  JNJ: "Johnson & Johnson",
  JPM: "JPMorgan Chase & Co.",
  KO: "The Coca-Cola Company",
  LLY: "Eli Lilly and Company",
  LMT: "Lockheed Martin Corporation",
  LULU: "Lululemon Athletica Inc.",
  MA: "Mastercard Incorporated",
  MCD: "McDonald's Corporation",
  META: "Meta Platforms, Inc.",
  MRK: "Merck & Co., Inc.",
  MSFT: "Microsoft Corporation",
  MU: "Micron Technology, Inc.",
  NFLX: "Netflix, Inc.",
  NVDA: "NVIDIA Corporation",
  NKE: "Nike, Inc.",
  ORCL: "Oracle Corporation",
  PEP: "PepsiCo, Inc.",
  PFE: "Pfizer Inc.",
  PG: "The Procter & Gamble Company",
  PLTR: "Palantir Technologies Inc.",
  PYPL: "PayPal Holdings, Inc.",
  QCOM: "Qualcomm Incorporated",
  SBUX: "Starbucks Corporation",
  SHOP: "Shopify Inc.",
  SMCI: "Super Micro Computer, Inc.",
  TSLA: "Tesla, Inc.",
  UBER: "Uber Technologies, Inc.",
  UNH: "UnitedHealth Group Incorporated",
  V: "Visa Inc.",
  WMT: "Walmart Inc.",
  XOM: "Exxon Mobil Corporation",
};

export function getAssetDisplayName(
  symbol: string,
  fallback?: string | null
) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const fallbackName = fallback?.trim();

  return (
    knownAssetNames[normalizedSymbol] ??
    (fallbackName && fallbackName !== normalizedSymbol
      ? fallbackName
      : normalizedSymbol)
  );
}
