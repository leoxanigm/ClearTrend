import { getCurrentUserIdentity } from "@/lib/profile";
import { NextResponse } from "next/server";

export async function requireAuthenticatedUser() {
  const identity = await getCurrentUserIdentity();

  if (!identity) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return null;
}
