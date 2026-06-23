import { requireApiIdentity } from "@/lib/api-auth";
import type { MlHorizon } from "@/lib/ml-analysis";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const symbolPattern = /^[A-Z0-9.^=-]{1,15}$/;
const horizons = new Set<MlHorizon>(["1D", "1W", "1M"]);

export async function GET(req: Request) {
  const { response } = await requireApiIdentity(req);

  if (response) {
    return response;
  }

  const analysisUrl = process.env.ANALYSIS_URL;

  if (!analysisUrl) {
    return NextResponse.json(
      { error: "Analysis service is not configured." },
      { status: 503 }
    );
  }

  const url = new URL(req.url);
  let symbol = url.searchParams.get("symbol")?.trim().toUpperCase() ?? "";
  const horizonValue =
    url.searchParams.get("horizon")?.trim().toUpperCase() ?? "1D";

  if (!symbolPattern.test(symbol)) {
    return NextResponse.json(
      { error: "Invalid symbol." },
      { status: 400 }
    );
  }

  if (!horizons.has(horizonValue as MlHorizon)) {
    return NextResponse.json(
      { error: "Invalid ML horizon." },
      { status: 400 }
    );
  }

  if (symbol === "GOOG") symbol = "GOOGL";

  const target = new URL(
    `/ml/analyse/${encodeURIComponent(symbol)}`,
    analysisUrl
  );
  target.searchParams.set("horizon", horizonValue);

  try {
    const analysisResponse = await fetch(target, {
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    const body = await analysisResponse.json();

    if (!analysisResponse.ok) {
      const mappedStatus =
        analysisResponse.status === 400
          ? 400
          : analysisResponse.status === 503
            ? 503
            : 502;
      return NextResponse.json(
        {
          error:
            typeof body?.detail === "string"
              ? body.detail
              : "ML analysis failed.",
        },
        { status: mappedStatus }
      );
    }

    return NextResponse.json(body);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "ML analysis service is unavailable." },
      { status: 502 }
    );
  }
}
