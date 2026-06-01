import { authOptions } from "@/lib/auth-options";
import { getPrisma } from "@/lib/prisma";
import {
  clampAvatarOffsetForScale,
  clampAvatarScale,
  normalizeDisplayName,
  validateDisplayName,
} from "@/lib/profile-rules";
import type { UserProfile } from "@/lib/profile-types";
import { getServerSession } from "next-auth";

type CurrentUserIdentity = {
  email: string;
  name: string | null;
  oauthProvider: string | null;
  oauthProviderAccountId: string | null;
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
  role: "USER" | "ADMIN" | "ANALYST";
};

export function getFallbackDisplayName(email: string) {
  return email.split("@")[0] || email;
}

function toProfile(row: UserProfileRow): UserProfile {
  const avatarScale = clampAvatarScale(row.avatarScale ?? 1);

  return {
    avatarMimeType: row.avatarMimeType,
    avatarOffsetX: clampAvatarOffsetForScale(
      row.avatarOffsetX ?? 0,
      avatarScale
    ),
    avatarOffsetY: clampAvatarOffsetForScale(
      row.avatarOffsetY ?? 0,
      avatarScale
    ),
    avatarScale,
    avatarSize: row.avatarSize,
    avatarUrl: row.avatarUrl,
    displayName: row.displayName ?? getFallbackDisplayName(row.email),
    email: row.email,
    id: row.id,
    role: row.role,
  };
}

export async function getCurrentUserIdentity(): Promise<
  CurrentUserIdentity | null
> {
  const authSession = await getServerSession(authOptions);
  const sessionUser = authSession?.user as Record<string, unknown> | undefined;
  const email = typeof sessionUser?.email === "string" ? sessionUser.email : null;

  if (!email) {
    return null;
  }

  const oauthProvider =
    typeof sessionUser?.oauthProvider === "string"
      ? sessionUser.oauthProvider
      : null;
  const oauthProviderAccountId =
    typeof sessionUser?.oauthProviderAccountId === "string"
      ? sessionUser.oauthProviderAccountId
      : null;
  const name = typeof sessionUser?.name === "string" ? sessionUser.name : null;

  return {
    email,
    name,
    oauthProvider,
    oauthProviderAccountId,
    userId: typeof sessionUser?.id === "string" ? sessionUser.id : null,
  };
}

export async function readUserProfileById(id: string) {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<UserProfileRow[]>`
    SELECT
      id,
      email,
      role,
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
      role,
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

async function readUserProfileByOauth(
  oauthProvider: string,
  oauthProviderAccountId: string
) {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<UserProfileRow[]>`
    SELECT
      id,
      email,
      role,
      "displayName",
      "avatarUrl",
      "avatarMimeType",
      "avatarSize",
      "avatarScale",
      "avatarOffsetX",
      "avatarOffsetY"
    FROM users
    WHERE
      "oauthProvider" = ${oauthProvider}
      AND "oauthProviderAccountId" = ${oauthProviderAccountId}
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

  const existingProfile =
    identity.oauthProvider && identity.oauthProviderAccountId
      ? await readUserProfileByOauth(
          identity.oauthProvider,
          identity.oauthProviderAccountId
        )
      : await readUserProfileByEmail(identity.email);

  if (existingProfile) {
    return existingProfile;
  }

  const prisma = getPrisma();
  const initialDisplayName = getInitialDisplayName(
    identity.name,
    identity.email
  );

  try {
    await prisma.user.create({
      data: {
        email: identity.email,
        displayName: initialDisplayName,
        oauthProvider: identity.oauthProvider,
        oauthProviderAccountId: identity.oauthProviderAccountId,
      },
    });
  } catch (error) {
    const isUniqueEmailConflict =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002";

    if (!isUniqueEmailConflict) {
      throw error;
    }
  }

  return readUserProfileByEmail(identity.email);
}
