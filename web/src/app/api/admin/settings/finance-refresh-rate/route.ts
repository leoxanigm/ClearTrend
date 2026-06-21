import { requireAdminUser } from "@/lib/admin-auth";
import { apiError, readJsonBody } from "@/lib/api-response";
import {
  deleteFinanceRefreshRateSeconds,
  financeRefreshRateOptions,
  getFinanceRefreshRateSeconds,
  setFinanceRefreshRateSeconds,
} from "@/lib/app-settings";
import { NextResponse } from "next/server";

function readRefreshRateSeconds(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const value = (body as { refreshRateSeconds?: unknown }).refreshRateSeconds;
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : NaN;

  return financeRefreshRateOptions.includes(
    parsed as (typeof financeRefreshRateOptions)[number]
  )
    ? parsed
    : null;
}

async function writeFinanceRefreshRate(req: Request) {
  const { response } = await requireAdminUser(req);

  if (response) {
    return response;
  }

  const body = await readJsonBody(req);
  const refreshRateSeconds = readRefreshRateSeconds(body);

  if (!refreshRateSeconds) {
    return apiError("Expected refreshRateSeconds to be 60, 300, or 900.", 400);
  }

  const savedRefreshRateSeconds =
    await setFinanceRefreshRateSeconds(refreshRateSeconds);

  return NextResponse.json({
    refreshRateSeconds: savedRefreshRateSeconds,
  });
}

export async function GET(req: Request) {
  const { response } = await requireAdminUser(req);

  if (response) {
    return response;
  }

  const refreshRateSeconds = await getFinanceRefreshRateSeconds();

  return NextResponse.json({
    refreshRateSeconds,
  });
}

export async function POST(req: Request) {
  return writeFinanceRefreshRate(req);
}

export async function PUT(req: Request) {
  return writeFinanceRefreshRate(req);
}

export async function PATCH(req: Request) {
  return writeFinanceRefreshRate(req);
}

export async function DELETE(req: Request) {
  const { response } = await requireAdminUser(req);

  if (response) {
    return response;
  }

  const refreshRateSeconds = await deleteFinanceRefreshRateSeconds();

  return NextResponse.json({
    refreshRateSeconds,
  });
}