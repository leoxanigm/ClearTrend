import { searchFinnhubAssets } from "@/lib/finnhub";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({
      results: [],
    });
  }

  if (query.length > 40) {
    return NextResponse.json(
      {
        error: "Search query is too long.",
      },
      { status: 400 }
    );
  }

  try {
    const results = await searchFinnhubAssets(query);

    return NextResponse.json({
      results,
    });
  } catch {
    return NextResponse.json(
      {
        error: "Asset search failed.",
      },
      { status: 502 }
    );
  }
}
