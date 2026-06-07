import { apiError } from "@/lib/api-response";
import { deleteStoredAvatar } from "@/lib/avatar-storage";
import { getPrisma } from "@/lib/prisma";
import { getCurrentUserProfile } from "@/lib/profile";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  await deleteStoredAvatar(profile.avatarUrl);

  return new NextResponse(null, {
    status: 204,
  });
}
