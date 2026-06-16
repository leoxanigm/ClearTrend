const displayNameMinLength = 3;
const displayNameMaxLength = 32;
// At stronger zoom levels, use a stable crop ratio for predictable dragging.
const avatarFixedCropRatio = 2 / 3;
const avatarFixedCropRatioScale = 1.5;

// Crop values are stored as scale and percentage offsets in the user profile.
export const avatarCropLimits = {
  maxOffset: 100,
  maxScale: 2.5,
  minOffset: -100,
  minScale: 1,
};

// Client and server share the same accepted file types and byte limit.
export const avatarUploadRules = {
  accept: "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp",
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  maxSize: 5 * 1024 * 1024,
};

export const displayNameLimits = {
  max: displayNameMaxLength,
  min: displayNameMinLength,
};

// Normalize repeated whitespace before validation and persistence.
export function normalizeDisplayName(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
}

// Return a normalized value together with a stable, translatable error message.
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

// Treat form and database input as untrusted before using it in CSS transforms.
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

// Generic absolute offset clamp; scale-aware code uses the stricter helper below.
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

// Interpolate the crop stage ratio until the fixed zoom threshold is reached.
export function getAvatarCropRatio(scaleValue: unknown) {
  const scale = clampAvatarScale(scaleValue);

  if (scale <= avatarCropLimits.minScale) {
    return 1;
  }

  if (scale >= avatarFixedCropRatioScale) {
    return avatarFixedCropRatio;
  }

  const progress =
    (scale - avatarCropLimits.minScale) /
    (avatarFixedCropRatioScale - avatarCropLimits.minScale);

  return 1 - progress * (1 - avatarFixedCropRatio);
}

// More zoom reveals more movable image area, capped by the persisted limit.
export function getAvatarMaxOffset(scaleValue: unknown) {
  const scale = clampAvatarScale(scaleValue);

  if (scale <= avatarCropLimits.minScale) {
    return 0;
  }

  const coverageOffset = Math.max(0, (scale - 1) * 50);

  return Math.min(avatarCropLimits.maxOffset, coverageOffset);
}

// Keep an offset inside the area actually available at the selected zoom.
export function clampAvatarOffsetForScale(
  value: unknown,
  scaleValue: unknown
) {
  const nextValue = Number(value);

  if (!Number.isFinite(nextValue)) {
    return 0;
  }

  const maxOffset = getAvatarMaxOffset(scaleValue);

  return Math.min(maxOffset, Math.max(-maxOffset, nextValue));
}

// New images open at the zoom where the standard crop ratio is established.
export function getDefaultAvatarScale() {
  return avatarFixedCropRatioScale;
}
