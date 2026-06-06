import { requireAdminUser } from "@/lib/admin-auth";
import { readJsonBody } from "@/lib/api-response";
import { setFinanceRefreshRateSeconds } from "@/lib/app-settings";
import { NextResponse } from "next/server";

export async function PATCH(req: Request) {
  const { response } = await requireAdminUser();

  if (response) {
    return response;
  }

  const body = await readJsonBody(req);
  const refreshRateSeconds = await setFinanceRefreshRateSeconds(
    body && typeof body === "object"
      ? (body as { refreshRateSeconds?: unknown }).refreshRateSeconds
      : null
  );

  return NextResponse.json({
    refreshRateSeconds,
  });
}
