import { sessionCookieName } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST() {
  const response = new NextResponse(null, {
    headers: {
      Location: "/login",
    },
    status: 303,
  });

  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
