import { getCurrentUserProfile, readUserProfileById } from "@/lib/profile";
import { getPrisma } from "@/lib/prisma";
import {
  AvatarImageError,
  processAvatarImage,
} from "@/lib/avatar-images";
import {
  deleteStoredAvatar,
  ensureAvatarDirectory,
  privateAvatarUrlPrefix,
} from "@/lib/avatar-storage";
import {
  avatarUploadRules,
  clampAvatarOffsetForScale,
  clampAvatarScale,
  validateDisplayName,
} from "@/lib/profile-rules";
import { randomUUID } from "crypto";
import { writeFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type AvatarUpload = {
  mimeType: string;
  size: number;
  url: string;
};

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function readString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function readBoolean(value: FormDataEntryValue | null) {
  return value === "true" || value === "1";
}

function isFileEntry(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

async function saveAvatar(
  file: File,
  userId: string
): Promise<AvatarUpload | { error: string }> {
  if (!avatarUploadRules.allowedMimeTypes.includes(file.type)) {
    return {
      error: "Avatar must be a JPEG, PNG, or WebP image.",
    };
  }

  if (file.size <= 0) {
    return {
      error: "Avatar file is empty.",
    };
  }

  if (file.size > avatarUploadRules.maxSize) {
    return {
      error: "Avatar must be 5 MB or smaller.",
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let processedImage;

  try {
    processedImage = await processAvatarImage(buffer, file.type);
  } catch (error) {
    return {
      error: error instanceof AvatarImageError
        ? error.message
        : "Avatar image could not be processed.",
    };
  }

  const avatarDirectory = await ensureAvatarDirectory();
  const fileName = `${userId}-${randomUUID()}.webp`;
  const filePath = join(avatarDirectory, fileName);

  await writeFile(filePath, processedImage.buffer, {
    flag: "wx",
    mode: 0o600,
  });

  return {
    mimeType: processedImage.mimeType,
    size: processedImage.size,
    url: `${privateAvatarUrlPrefix}${fileName}`,
  };
}

export async function GET() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return jsonError("Unauthorized.", 401);
  }

  return NextResponse.json({ profile });
}

export async function PATCH(req: Request) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return jsonError("Unauthorized.", 401);
  }

  const contentType = req.headers.get("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    return jsonError("Expected multipart form data.", 415);
  }

  const formData = await req.formData().catch(() => null);

  if (!formData) {
    return jsonError("Invalid form data.");
  }

  const displayNameValidation = validateDisplayName(
    formData.get("displayName")
  );

  if (displayNameValidation.error || !displayNameValidation.value) {
    return jsonError(displayNameValidation.error ?? "Invalid display name.");
  }

  const avatarScale = clampAvatarScale(readString(formData.get("avatarScale")));
  const avatarOffsetX = clampAvatarOffsetForScale(
    readString(formData.get("avatarOffsetX")),
    avatarScale
  );
  const avatarOffsetY = clampAvatarOffsetForScale(
    readString(formData.get("avatarOffsetY")),
    avatarScale
  );
  const removeAvatar = readBoolean(formData.get("removeAvatar"));
  const avatarFile = formData.get("avatar");

  let nextAvatarUrl = profile.avatarUrl;
  let nextAvatarMimeType = profile.avatarMimeType;
  let nextAvatarSize = profile.avatarSize;
  let uploadedAvatarUrl: string | null = null;

  if (isFileEntry(avatarFile) && avatarFile.size > 0) {
    const upload = await saveAvatar(avatarFile, profile.id);

    if ("error" in upload) {
      return jsonError(upload.error);
    }

    nextAvatarUrl = upload.url;
    nextAvatarMimeType = upload.mimeType;
    nextAvatarSize = upload.size;
    uploadedAvatarUrl = upload.url;
  } else if (removeAvatar) {
    nextAvatarUrl = null;
    nextAvatarMimeType = null;
    nextAvatarSize = null;
  }

  const nextAvatarScale = nextAvatarUrl ? avatarScale : 1;
  const nextAvatarOffsetX = nextAvatarUrl ? avatarOffsetX : 0;
  const nextAvatarOffsetY = nextAvatarUrl ? avatarOffsetY : 0;
  const prisma = getPrisma();

  try {
    await prisma.$executeRaw`
      UPDATE users
      SET
        "displayName" = ${displayNameValidation.value},
        "avatarUrl" = ${nextAvatarUrl},
        "avatarMimeType" = ${nextAvatarMimeType},
        "avatarSize" = ${nextAvatarSize},
        "avatarScale" = ${nextAvatarScale},
        "avatarOffsetX" = ${nextAvatarOffsetX},
        "avatarOffsetY" = ${nextAvatarOffsetY},
        "updatedAt" = NOW()
      WHERE id = ${profile.id}
    `;
  } catch {
    await deleteStoredAvatar(uploadedAvatarUrl);

    return jsonError("Profile could not be saved.", 500);
  }

  if (
    (uploadedAvatarUrl || removeAvatar) &&
    profile.avatarUrl !== nextAvatarUrl
  ) {
    await deleteStoredAvatar(profile.avatarUrl);
  }

  const updatedProfile = await readUserProfileById(profile.id);

  return NextResponse.json({ profile: updatedProfile ?? profile });
}
