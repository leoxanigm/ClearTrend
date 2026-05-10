import {
  getWatchlistAssets,
  parseWatchlistSymbols,
} from "@/lib/assets";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbols = parseWatchlistSymbols(url.searchParams.get("symbols"));
  const assets = await getWatchlistAssets(symbols);

  return NextResponse.json({
    assets,
  });
}
