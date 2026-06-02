import { apiError } from "@/lib/api-response";
import { getPrisma } from "@/lib/prisma";
import { getCurrentUserProfile } from "@/lib/profile";
import { unlink } from "fs/promises";
import { basename, join, resolve } from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const avatarUploadPath = "/uploads/avatars";

function getAvatarDirectory() {
  return join(process.cwd(), "public", "uploads", "avatars");
}

async function deleteLocalAvatar(url: string | null) {
  if (!url?.startsWith(`${avatarUploadPath}/`)) {
    return;
  }

  const avatarDirectory = resolve(getAvatarDirectory());
  const avatarPath = resolve(avatarDirectory, basename(url));

  if (!avatarPath.startsWith(`${avatarDirectory}/`)) {
    return;
  }

  await unlink(avatarPath).catch(() => null);
}

export async function DELETE() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return apiError("Unauthorized.", 401);
  }

  const prisma = getPrisma();

  await prisma.user.delete({
    where: {
      id: profile.id,
    },
  });

  await deleteLocalAvatar(profile.avatarUrl);

  return new NextResponse(null, {
    status: 204,
  });
}
