import {
  getUserWatchlistAssets,
  normalizeWatchlistSymbols,
  parseWatchlistSymbols,
  setUserFavoriteSymbol,
} from "@/lib/assets";
import { getCurrentUserProfile } from "@/lib/profile";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(req.url);
  const rawSymbols = url.searchParams.get("symbols");
  const symbols =
    rawSymbols === null
      ? parseWatchlistSymbols(rawSymbols)
      : normalizeWatchlistSymbols(rawSymbols.split(","));
  const assets = await getUserWatchlistAssets(profile.id, symbols, {
    includeSavedFavorites: rawSymbols === null,
  });

  return NextResponse.json({
    assets,
  });
}

export async function PATCH(req: Request) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const payload = body as { isFavorite?: unknown; symbol?: unknown };

  if (
    typeof payload.symbol !== "string" ||
    typeof payload.isFavorite !== "boolean"
  ) {
    return NextResponse.json(
      { error: "Invalid favorite payload." },
      { status: 400 }
    );
  }

  const [symbol] = normalizeWatchlistSymbols([payload.symbol]);

  if (!symbol) {
    return NextResponse.json({ error: "Invalid symbol." }, { status: 400 });
  }

  const favoriteSymbols = await setUserFavoriteSymbol(
    profile.id,
    symbol,
    payload.isFavorite
  );

  return NextResponse.json({
    isFavorite: favoriteSymbols.includes(symbol),
    symbol,
  });
}
