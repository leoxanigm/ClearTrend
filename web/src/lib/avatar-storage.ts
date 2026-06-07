import { mkdir, unlink } from "fs/promises";
import { basename, resolve } from "path";

export const privateAvatarUrlPrefix = "/api/profile/avatar/";
const legacyAvatarUrlPrefix = "/uploads/avatars/";

export function getAvatarDirectory() {
  return process.env.AVATAR_UPLOAD_DIR ??
    "/app/uploads/avatars";
}

export async function ensureAvatarDirectory() {
  const directory = getAvatarDirectory();

  await mkdir(directory, {
    mode: 0o700,
    recursive: true,
  });

  return directory;
}

export function getPrivateAvatarFileName(url: string | null) {
  if (!url?.startsWith(privateAvatarUrlPrefix)) {
    return null;
  }

  const fileName = basename(url);

  return fileName === url.slice(privateAvatarUrlPrefix.length)
    ? fileName
    : null;
}

function getStoredAvatarPath(url: string | null) {
  const privateFileName = getPrivateAvatarFileName(url);

  if (privateFileName) {
    return {
      directory: getAvatarDirectory(),
      fileName: privateFileName,
    };
  }

  if (url?.startsWith(legacyAvatarUrlPrefix)) {
    return {
      directory: "/app/public/uploads/avatars",
      fileName: basename(url),
    };
  }

  return null;
}

export async function deleteStoredAvatar(url: string | null) {
  const storedAvatar = getStoredAvatarPath(url);

  if (!storedAvatar) {
    return;
  }

  const directory = resolve(
    /* turbopackIgnore: true */ storedAvatar.directory
  );
  const filePath = resolve(
    /* turbopackIgnore: true */ directory,
    storedAvatar.fileName
  );

  if (!filePath.startsWith(`${directory}/`)) {
    return;
  }

  await unlink(filePath).catch(() => null);
}
