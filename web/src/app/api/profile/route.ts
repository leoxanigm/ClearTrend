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

// Metadata stored in the profile after the binary image has been normalized.
type AvatarUpload = {
  mimeType: string;
  size: number;
  url: string;
};

// Keep route errors consistent for client-side translation.
function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function readString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function readBoolean(value: FormDataEntryValue | null) {
  return value === "true" || value === "1";
}

// FormData values can be text or files, so narrow the avatar entry explicitly.
function isFileEntry(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

// Validate and persist one avatar before any profile database mutation.
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

  // Sharp validates the decoded image and always returns normalized WebP bytes.
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
  // A fresh UUID prevents collisions and stale browser-cache reuse.
  const fileName = `${userId}-${randomUUID()}.webp`;
  const filePath = join(avatarDirectory, fileName);

  await writeFile(filePath, processedImage.buffer, {
    // wx refuses the extremely unlikely case where the generated name exists.
    flag: "wx",
    mode: 0o600,
  });

  return {
    mimeType: processedImage.mimeType,
    size: processedImage.size,
    url: `${privateAvatarUrlPrefix}${fileName}`,
  };
}

// Return the authenticated user's current profile.
export async function GET() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return jsonError("Unauthorized.", 401);
  }

  return NextResponse.json({ profile });
}

// Update scalar profile fields and optionally upload, replace, or remove an avatar.
export async function PATCH(req: Request) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return jsonError("Unauthorized.", 401);
  }

  const contentType = req.headers.get("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    return jsonError("Expected multipart form data.", 415);
  }

  // The server repeats all client validation because multipart input is untrusted.
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
  // Track the new file separately so it can be removed if persistence fails.
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
    // Raw SQL updates avatar metadata and crop values as one database operation.
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
    // A failed database update must not leave the newly written file orphaned.
    await deleteStoredAvatar(uploadedAvatarUrl);

    return jsonError("Profile could not be saved.", 500);
  }

  if (
    (uploadedAvatarUrl || removeAvatar) &&
    profile.avatarUrl !== nextAvatarUrl
  ) {
    // Delete the previous file only after the new profile state is committed.
    await deleteStoredAvatar(profile.avatarUrl);
  }

  const updatedProfile = await readUserProfileById(profile.id);

  return NextResponse.json({ profile: updatedProfile ?? profile });
}
