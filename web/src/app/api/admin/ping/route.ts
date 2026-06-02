import { requireAdminUser } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export async function GET() {
  const { profile, response } = await requireAdminUser();

  if (!profile) {
    return response;
  }

  return NextResponse.json({
    message: "Admin access granted.",
    userId: profile.id,
  });
}