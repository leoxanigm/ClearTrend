import { requireAuthenticatedUser } from "@/lib/api-auth";
import { ExternalDataCooldownError } from "@/lib/external-data";
import { searchFinnhubAssets } from "@/lib/finnhub";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const unauthorizedResponse = await requireAuthenticatedUser();

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

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
  } catch (error) {
    if (error instanceof ExternalDataCooldownError) {
      return NextResponse.json(
        {
          error: "Asset search was requested recently. Try again shortly.",
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: "Asset search failed.",
      },
      { status: 502 }
    );
  }
}
