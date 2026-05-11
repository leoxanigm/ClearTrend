import { getCurrentUserProfile, readUserProfileById } from "@/lib/profile";
import { getPrisma } from "@/lib/prisma";
import {
  avatarUploadRules,
  clampAvatarOffset,
  clampAvatarScale,
  validateDisplayName,
} from "@/lib/profile-rules";
import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import { basename, join, resolve } from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const avatarUploadPath = "/uploads/avatars";
const allowedAvatarTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

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

function hasValidImageSignature(mimeType: string, buffer: Buffer) {
  if (mimeType === "image/jpeg") {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  if (mimeType === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  if (mimeType === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  return false;
}

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

async function saveAvatar(
  file: File,
  userId: string
): Promise<AvatarUpload | { error: string }> {
  const extension = allowedAvatarTypes.get(file.type);

  if (!extension) {
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

  if (!hasValidImageSignature(file.type, buffer)) {
    return {
      error: "Avatar file content does not match its image type.",
    };
  }

  const avatarDirectory = getAvatarDirectory();
  const fileName = `${userId}-${randomUUID()}.${extension}`;
  const filePath = join(avatarDirectory, fileName);

  await mkdir(avatarDirectory, { recursive: true });
  await writeFile(filePath, buffer, { flag: "wx" });

  return {
    mimeType: file.type,
    size: file.size,
    url: `${avatarUploadPath}/${fileName}`,
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
  const avatarOffsetX = clampAvatarOffset(
    readString(formData.get("avatarOffsetX"))
  );
  const avatarOffsetY = clampAvatarOffset(
    readString(formData.get("avatarOffsetY"))
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
    await deleteLocalAvatar(uploadedAvatarUrl);

    return jsonError("Profile could not be saved.", 500);
  }

  if (
    (uploadedAvatarUrl || removeAvatar) &&
    profile.avatarUrl !== nextAvatarUrl
  ) {
    await deleteLocalAvatar(profile.avatarUrl);
  }

  const updatedProfile = await readUserProfileById(profile.id);

  return NextResponse.json({ profile: updatedProfile ?? profile });
}
