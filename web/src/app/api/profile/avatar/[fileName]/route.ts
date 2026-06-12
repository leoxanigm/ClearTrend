import {
  getAvatarDirectory,
  getPrivateAvatarFileName,
} from "@/lib/avatar-storage";
import { getCurrentUserProfile } from "@/lib/profile";
import { readFile } from "fs/promises";
import { basename, join } from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AvatarRouteContext = {
  params: Promise<{
    fileName: string;
  }>;
};

// Serve only the active avatar owned by the authenticated user.
export async function GET(_request: Request, context: AvatarRouteContext) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { fileName } = await context.params;
  const expectedFileName = getPrivateAvatarFileName(profile.avatarUrl);

  // Exact equality prevents users from requesting another account's avatar.
  // basename additionally rejects path components such as ../.
  if (
    !expectedFileName ||
    fileName !== expectedFileName ||
    basename(fileName) !== fileName
  ) {
    return NextResponse.json({ error: "Avatar not found." }, { status: 404 });
  }

  const avatarPath = join(
    /* turbopackIgnore: true */ getAvatarDirectory(),
    expectedFileName
  );
  const avatar = await readFile(avatarPath).catch(() => null);

  if (!avatar) {
    return NextResponse.json({ error: "Avatar not found." }, { status: 404 });
  }

  // UUID filenames make long private caching safe after avatar replacement.
  return new NextResponse(new Uint8Array(avatar), {
    headers: {
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Type": profile.avatarMimeType ?? "image/webp",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
