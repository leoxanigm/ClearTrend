import { mkdir, unlink } from "fs/promises";
import { basename, resolve } from "path";

// New avatars are exposed only through the authenticated API route.
export const privateAvatarUrlPrefix = "/api/profile/avatar/";
// Kept solely so an existing legacy avatar can still be deleted during cleanup.
const legacyAvatarUrlPrefix = "/uploads/avatars/";

// Docker provides this path through a persistent volume; tests may override it.
export function getAvatarDirectory() {
  return process.env.AVATAR_UPLOAD_DIR ??
    "/app/uploads/avatars";
}

// Create the private directory lazily with owner-only access.
export async function ensureAvatarDirectory() {
  const directory = getAvatarDirectory();

  await mkdir(directory, {
    mode: 0o700,
    recursive: true,
  });

  return directory;
}

// Extract only a simple filename belonging to the private avatar URL namespace.
export function getPrivateAvatarFileName(url: string | null) {
  if (!url?.startsWith(privateAvatarUrlPrefix)) {
    return null;
  }

  const fileName = basename(url);

  return fileName === url.slice(privateAvatarUrlPrefix.length)
    ? fileName
    : null;
}

// Resolve both current and legacy storage locations for deletion only.
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

// Remove a replaced/deleted avatar without allowing its URL to escape the directory.
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

  // The resolved path must remain a child of the expected storage directory.
  if (!filePath.startsWith(`${directory}/`)) {
    return;
  }

  // Missing files are already in the desired state and do not fail the request.
  await unlink(filePath).catch(() => null);
}
