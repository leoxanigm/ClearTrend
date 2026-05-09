import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  const session = verifySessionToken(
    cookieStore.get(sessionCookieName)?.value
  );

  return NextResponse.json({
    authenticated: Boolean(session),
  });
}
