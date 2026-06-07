import {
  getUserFavoriteSymbols,
  mergeUserFavoriteSymbols,
} from "@/lib/assets";
import { getApiUserProfile } from "@/lib/api-auth";
import { apiError } from "@/lib/api-response";
import { fetchAnalysisTickers } from "@/lib/analysis-data";
import {
  createWatchlistFile,
  validateWatchlistFile,
  watchlistFileRules,
} from "@/lib/watchlist-file";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isJsonFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof File !== "undefined" &&
    value instanceof File &&
    value.name.toLowerCase().endsWith(".json") &&
    value.type === "application/json"
  );
}

export async function GET(req: Request) {
  const { profile, response } = await getApiUserProfile(req);

  if (response) {
    return response;
  }

  const favoriteSymbols = await getUserFavoriteSymbols(profile.id);
  const payload = createWatchlistFile(favoriteSymbols);
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(`${JSON.stringify(payload, null, 2)}\n`, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="cleartrend-watchlist-${date}.json"`,
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(req: Request) {
  const { profile, response } = await getApiUserProfile(req);

  if (response) {
    return response;
  }

  const contentType = req.headers.get("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    return apiError("Expected multipart form data.", 415);
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("watchlist") ?? null;

  if (!isJsonFile(file)) {
    return apiError("Choose a valid JSON watchlist file.", 400);
  }

  if (file.size <= 0) {
    return apiError("The watchlist file is empty.", 400);
  }

  if (file.size > watchlistFileRules.maxSize) {
    return apiError("The watchlist file must be 64 KB or smaller.", 400);
  }

  const payload = await file.text()
    .then((text) => JSON.parse(text) as unknown)
    .catch(() => null);

  if (payload === null) {
    return apiError("The watchlist file contains invalid JSON.", 400);
  }

  const validation = validateWatchlistFile(payload);

  if (validation.error) {
    return apiError(validation.error, 400);
  }

  let knownTickers: string[];

  try {
    knownTickers = await fetchAnalysisTickers();
  } catch {
    return apiError("Ticker validation service is unavailable.", 503);
  }

  const knownTickerSet = new Set(knownTickers);
  const recognizedSymbols = validation.symbols.filter((symbol) =>
    knownTickerSet.has(symbol)
  );
  const ignoredSymbols = validation.symbols.filter(
    (symbol) => !knownTickerSet.has(symbol)
  );

  if (recognizedSymbols.length === 0) {
    return apiError("No recognized symbol was found in the watchlist file.", 400);
  }

  const currentFavoriteSymbols = await getUserFavoriteSymbols(profile.id);
  const currentFavoriteSet = new Set(currentFavoriteSymbols);
  const importedSymbols = recognizedSymbols.filter(
    (symbol) => !currentFavoriteSet.has(symbol)
  );
  const alreadyFavoriteSymbols = recognizedSymbols.filter((symbol) =>
    currentFavoriteSet.has(symbol)
  );
  const favoriteSymbols = await mergeUserFavoriteSymbols(
    profile.id,
    recognizedSymbols
  );

  return NextResponse.json({
    alreadyFavoriteSymbols,
    favoriteSymbols,
    ignoredSymbols,
    importedSymbols,
    invalidEntries: validation.invalidEntries,
  });
}
