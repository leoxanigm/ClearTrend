const displayNameMinLength = 3;
const displayNameMaxLength = 32;

export const avatarCropLimits = {
  maxOffset: 25,
  maxScale: 2.5,
  minOffset: -25,
  minScale: 1,
};

export const avatarUploadRules = {
  accept: "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp",
  maxSize: 5 * 1024 * 1024,
};

export const displayNameLimits = {
  max: displayNameMaxLength,
  min: displayNameMinLength,
};

export function normalizeDisplayName(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
}

export function validateDisplayName(value: unknown) {
  const displayName = normalizeDisplayName(value);

  if (displayName.length < displayNameMinLength) {
    return {
      error: `Display name must be at least ${displayNameMinLength} characters.`,
      value: null,
    };
  }

  if (displayName.length > displayNameMaxLength) {
    return {
      error: `Display name must be ${displayNameMaxLength} characters or fewer.`,
      value: null,
    };
  }

  if (/[\u0000-\u001f\u007f<>]/.test(displayName)) {
    return {
      error: "Display name contains unsupported characters.",
      value: null,
    };
  }

  if (!/[\p{L}\p{N}]/u.test(displayName)) {
    return {
      error: "Display name must include at least one letter or number.",
      value: null,
    };
  }

  return {
    error: null,
    value: displayName,
  };
}

export function clampAvatarScale(value: unknown) {
  const nextValue = Number(value);

  if (!Number.isFinite(nextValue)) {
    return 1;
  }

  return Math.min(
    avatarCropLimits.maxScale,
    Math.max(avatarCropLimits.minScale, nextValue)
  );
}

export function clampAvatarOffset(value: unknown) {
  const nextValue = Number(value);

  if (!Number.isFinite(nextValue)) {
    return 0;
  }

  return Math.min(
    avatarCropLimits.maxOffset,
    Math.max(avatarCropLimits.minOffset, nextValue)
  );
}
