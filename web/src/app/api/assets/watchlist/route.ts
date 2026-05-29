import {
  getUserFavoriteSymbols,
  getUserWatchlistAssets,
  normalizeWatchlistSymbols,
  parseWatchlistSymbols,
  setUserFavoriteSymbol,
} from "@/lib/assets";
import { getPrisma } from "@/lib/prisma";
import { getApiUserProfile } from "@/lib/api-auth";
import { apiError, readJsonBody } from "@/lib/api-response";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function readSymbol(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  return normalizeWatchlistSymbols([value])[0] ?? null;
}

function readSymbols(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  return normalizeWatchlistSymbols(
    value.filter((item): item is string => typeof item === "string")
  );
}

async function replaceFavoriteSymbols(userId: string, symbols: string[]) {
  const prisma = getPrisma();

  const rows = await prisma.$queryRaw<{ favoriteSymbols: string[] | null }[]>`
    UPDATE users
    SET
      "favoriteSymbols" = ${symbols},
      "updatedAt" = now()
    WHERE id = ${userId}
    RETURNING "favoriteSymbols"
  `;

  return normalizeWatchlistSymbols(rows[0]?.favoriteSymbols ?? []);
}

async function clearFavoriteSymbols(userId: string) {
  return replaceFavoriteSymbols(userId, []);
}

export async function GET(req: Request) {
  const { profile, response } = await getApiUserProfile(req);

  if (response) {
    return response;
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

export async function POST(req: Request) {
  const { profile, response } = await getApiUserProfile(req);

  if (response) {
    return response;
  }

  const body = await readJsonBody(req);

  if (!body || typeof body !== "object") {
    return apiError("Invalid JSON.", 400);
  }

  const symbol = readSymbol((body as { symbol?: unknown }).symbol);

  if (!symbol) {
    return apiError("Invalid symbol.", 400);
  }

  const favoriteSymbols = await setUserFavoriteSymbol(profile.id, symbol, true);
  const assets = await getUserWatchlistAssets(profile.id, favoriteSymbols, {
    includeSavedFavorites: false,
  });

  return NextResponse.json(
    {
      assets,
      favoriteSymbols,
      symbol,
    },
    { status: 201 }
  );
}

export async function PUT(req: Request) {
  const { profile, response } = await getApiUserProfile(req);

  if (response) {
    return response;
  }

  const body = await readJsonBody(req);

  if (!body || typeof body !== "object") {
    return apiError("Invalid JSON.", 400);
  }

  const symbols = readSymbols((body as { symbols?: unknown }).symbols);

  if (!symbols) {
    return apiError("Expected body: { symbols: string[] }.", 400);
  }

  const favoriteSymbols = await replaceFavoriteSymbols(profile.id, symbols);
  const assets = await getUserWatchlistAssets(profile.id, favoriteSymbols, {
    includeSavedFavorites: false,
  });

  return NextResponse.json({
    assets,
    favoriteSymbols,
  });
}

export async function PATCH(req: Request) {
  const { profile, response } = await getApiUserProfile(req);

  if (response) {
    return response;
  }

  const body = await readJsonBody(req);

  if (!body || typeof body !== "object") {
    return apiError("Invalid JSON.", 400);
  }

  const payload = body as { isFavorite?: unknown; symbol?: unknown };

  if (
    typeof payload.symbol !== "string" ||
    typeof payload.isFavorite !== "boolean"
  ) {
    return apiError("Invalid favorite payload.", 400);
  }

  const symbol = readSymbol(payload.symbol);

  if (!symbol) {
    return apiError("Invalid symbol.", 400);
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

export async function DELETE(req: Request) {
  const { profile, response } = await getApiUserProfile(req);

  if (response) {
    return response;
  }

  const body = await readJsonBody(req);

  if (!body) {
    const favoriteSymbols = await clearFavoriteSymbols(profile.id);

    return NextResponse.json({
      favoriteSymbols,
    });
  }

  if (typeof body !== "object") {
    return apiError("Invalid JSON.", 400);
  }

  const symbol = readSymbol((body as { symbol?: unknown }).symbol);

  if (!symbol) {
    return apiError("Invalid symbol.", 400);
  }

  const favoriteSymbols = await setUserFavoriteSymbol(profile.id, symbol, false);

  return NextResponse.json({
    favoriteSymbols,
    removed: symbol,
  });
}