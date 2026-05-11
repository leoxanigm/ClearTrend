import { authOptions } from "@/lib/auth-options";
import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

export async function GET() {
  const cookieStore = await cookies();
  const localSession = verifySessionToken(
    cookieStore.get(sessionCookieName)?.value
  );
  const authSession = await getServerSession(authOptions);
  const authenticated = Boolean(localSession || authSession?.user?.email);

  return NextResponse.json({
    authenticated,
  });
}
