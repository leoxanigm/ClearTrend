import { requireAdminUser } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { profile, response } = await requireAdminUser(req);

  if (!profile) {
    return response;
  }

  return NextResponse.json({
    message: "Admin access granted.",
    userId: profile.id,
  });
}