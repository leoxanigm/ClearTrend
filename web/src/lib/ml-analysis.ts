import type { ChartRange } from "@/lib/analysis-data";
import { mlAnalyzedSymbols } from "@/lib/asset-symbols";

export type MlHorizon = "1D" | "1W" | "1M";
export type MlTrend = "bearish" | "bullish" | "neutral";

export type MlPrediction = {
  confidence: number;
  confidenceLevel: "high" | "low" | "medium";
  estimatedPrice: number;
  estimatedReturn: number;
  horizon: MlHorizon;
  score: number;
  trend: MlTrend;
};

export type MlSentiment = {
  agreement?: number;
  available: boolean;
  bearishCount?: number;
  bullishCount?: number;
  neutralCount?: number;
  postCount: number;
  reason?: string;
  score?: number;
  summary?: string;
  summaryEn?: string;
  summaryEs?: string;
  summaryFr?: string;
};

export type MlAttention = {
  attention?: number;
  available: boolean;
  mentionGrowth?: number;
  mentions?: number;
  mentions24hAgo?: number;
  rank?: number;
};

export type MlAnalysis = {
  predictions: MlPrediction[];
  social: {
    attention: MlAttention;
    sentiment: MlSentiment;
  };
  ticker: string;
};

const mlAnalyzedSymbolSet = new Set<string>(mlAnalyzedSymbols);

export function supportsMlAnalysis(symbol: string | null | undefined) {
  return symbol
    ? mlAnalyzedSymbolSet.has(symbol.trim().replace(/^\^/, "").toUpperCase())
    : false;
}

export function chartRangeToMlHorizon(range: ChartRange): MlHorizon {
  if (range === "1D") {
    return "1D";
  }

  if (range === "1W") {
    return "1W";
  }

  return "1M";
}
