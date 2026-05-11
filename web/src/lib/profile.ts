import { authOptions } from "@/lib/auth-options";
import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import {
  clampAvatarOffset,
  clampAvatarScale,
  normalizeDisplayName,
  validateDisplayName,
} from "@/lib/profile-rules";
import type { UserProfile } from "@/lib/profile-types";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";

type CurrentUserIdentity = {
  email: string;
  name: string | null;
  userId: string | null;
};

type UserProfileRow = {
  avatarMimeType: string | null;
  avatarOffsetX: number | null;
  avatarOffsetY: number | null;
  avatarScale: number | null;
  avatarSize: number | null;
  avatarUrl: string | null;
  displayName: string | null;
  email: string;
  id: string;
};

export function getFallbackDisplayName(email: string) {
  return email.split("@")[0] || email;
}

function toProfile(row: UserProfileRow): UserProfile {
  return {
    avatarMimeType: row.avatarMimeType,
    avatarOffsetX: clampAvatarOffset(row.avatarOffsetX ?? 0),
    avatarOffsetY: clampAvatarOffset(row.avatarOffsetY ?? 0),
    avatarScale: clampAvatarScale(row.avatarScale ?? 1),
    avatarSize: row.avatarSize,
    avatarUrl: row.avatarUrl,
    displayName: row.displayName ?? getFallbackDisplayName(row.email),
    email: row.email,
    id: row.id,
  };
}

export async function getCurrentUserIdentity(): Promise<
  CurrentUserIdentity | null
> {
  const cookieStore = await cookies();
  const localSession = verifySessionToken(
    cookieStore.get(sessionCookieName)?.value
  );

  if (localSession) {
    return {
      email: localSession.email,
      name: null,
      userId: localSession.userId,
    };
  }

  const authSession = await getServerSession(authOptions);
  const email = authSession?.user?.email;

  if (!email) {
    return null;
  }

  return {
    email,
    name: authSession.user?.name ?? null,
    userId: null,
  };
}

export async function readUserProfileById(id: string) {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<UserProfileRow[]>`
    SELECT
      id,
      email,
      "displayName",
      "avatarUrl",
      "avatarMimeType",
      "avatarSize",
      "avatarScale",
      "avatarOffsetX",
      "avatarOffsetY"
    FROM users
    WHERE id = ${id}
    LIMIT 1
  `;

  return rows[0] ? toProfile(rows[0]) : null;
}

async function readUserProfileByEmail(email: string) {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<UserProfileRow[]>`
    SELECT
      id,
      email,
      "displayName",
      "avatarUrl",
      "avatarMimeType",
      "avatarSize",
      "avatarScale",
      "avatarOffsetX",
      "avatarOffsetY"
    FROM users
    WHERE email = ${email}
    LIMIT 1
  `;

  return rows[0] ? toProfile(rows[0]) : null;
}

function getInitialDisplayName(name: string | null, email: string) {
  const normalizedName = normalizeDisplayName(name);

  if (validateDisplayName(normalizedName).value) {
    return normalizedName;
  }

  const fallback = getFallbackDisplayName(email);

  return validateDisplayName(fallback).value ? fallback : null;
}

export async function getCurrentUserProfile() {
  const identity = await getCurrentUserIdentity();

  if (!identity) {
    return null;
  }

  if (identity.userId) {
    const profile = await readUserProfileById(identity.userId);

    if (profile) {
      return profile;
    }
  }

  const existingProfile = await readUserProfileByEmail(identity.email);

  if (existingProfile) {
    return existingProfile;
  }

  const prisma = getPrisma();
  const initialDisplayName = getInitialDisplayName(
    identity.name,
    identity.email
  );

  await prisma.$executeRaw`
    INSERT INTO users (email, "displayName")
    VALUES (${identity.email}, ${initialDisplayName})
    ON CONFLICT (email) DO NOTHING
  `;

  return readUserProfileByEmail(identity.email);
}
