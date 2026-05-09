import {
  createSessionToken,
  getSessionCookieOptions,
  sessionCookieName,
} from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function readPassword(value: unknown) {
  return typeof value === "string" ? value : "";
}

function invalidCredentialsResponse() {
  return NextResponse.json(
    { error: "Invalid email or password." },
    { status: 401 }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const fields = body as Record<string, unknown>;
    const email = normalizeEmail(fields.email);
    const password = readPassword(fields.password);

    if (!email || !password) {
      return NextResponse.json(
        { error: "Missing fields" },
        { status: 400 }
      );
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      return invalidCredentialsResponse();
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      return invalidCredentialsResponse();
    }

    const response = NextResponse.json({
      id: user.id,
      email: user.email,
    });

    response.cookies.set(
      sessionCookieName,
      createSessionToken({
        email: user.email,
        userId: user.id,
      }),
      getSessionCookieOptions()
    );

    return response;
  } catch {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
