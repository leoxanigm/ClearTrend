import { requireApiIdentity } from "@/lib/api-auth";
import {
  fetchAnalysisAssetPerformances,
  isChartRange,
  type ChartRange,
} from "@/lib/analysis-data";
import { normalizeWatchlistSymbols } from "@/lib/assets";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { response } = await requireApiIdentity(req);

  if (response) {
    return response;
  }

  const url = new URL(req.url);
  const rangeParam =
    url.searchParams.get("range")?.trim().toUpperCase() ?? "1D";
  const rawSymbols = url.searchParams.get("symbols") ?? "";
  const range: ChartRange = isChartRange(rangeParam) ? rangeParam : "1D";
  const symbols = normalizeWatchlistSymbols(rawSymbols.split(","));

  try {
    const performances = await fetchAnalysisAssetPerformances(symbols, range);

    return NextResponse.json({
      performances,
    });
  } catch {
    return NextResponse.json(
      {
        error: "Asset performance failed.",
      },
      { status: 502 }
    );
  }
}
