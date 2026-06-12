/* eslint-disable @next/next/no-img-element */

// Render a stored avatar with the non-destructive crop saved in the user profile.

import type { CSSProperties } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { getAvatarCropRatio } from "@/lib/profile-rules";
export { getDefaultAvatarScale } from "@/lib/profile-rules";

// Minimal profile data required to reproduce the saved avatar crop.
type AvatarProfile = {
  avatarOffsetX: number;
  avatarOffsetY: number;
  avatarScale: number;
  avatarUrl: string | null;
  displayName: string;
  email: string;
};

type UserAvatarProps = {
  className?: string;
  profile: AvatarProfile;
};

function safeNumber(value: number, fallback: number) {
  // Protect CSS transforms from invalid values read from persisted data.
  return Number.isFinite(value) ? value : fallback;
}

// Generate a stable textual fallback from the display name or email.
export function getUserInitial(
  profile: Pick<AvatarProfile, "displayName" | "email">
) {
  const source = profile.displayName || profile.email;

  return source.trim().slice(0, 1).toUpperCase() || "?";
}

export function getAvatarImageStyle(
  profile: Pick<AvatarProfile, "avatarScale">
): CSSProperties {
  // Scale is applied to the image while translation belongs to its outer stage.
  const scale = safeNumber(profile.avatarScale, 1);

  return {
    transform: `scale(${scale})`,
  };
}

export function getAvatarStageStyle(
  profile: Pick<
    AvatarProfile,
    "avatarOffsetX" | "avatarOffsetY" | "avatarScale"
  >
): CSSProperties {
  // Invalid offsets fall back to the centered image.
  const offsetX = safeNumber(profile.avatarOffsetX, 0);
  const offsetY = safeNumber(profile.avatarOffsetY, 0);
  // The stage translates the complete image behind the circular viewport.
  const cropRatio = getAvatarCropRatio(profile.avatarScale);

  return {
    // The first translate centers the stage; the second applies the saved crop.
    "--avatar-crop-ratio": cropRatio,
    transform: `translate(-50%, -50%) translate(${offsetX}%, ${offsetY}%)`,
  } as CSSProperties;
}

export function getAvatarCropStageStyle(
  profile: Pick<AvatarProfile, "avatarScale">
): CSSProperties {
  // Expose the crop ratio as a CSS custom property for preview components.
  return {
    "--avatar-crop-ratio": getAvatarCropRatio(profile.avatarScale),
  } as CSSProperties;
}

export function UserAvatar({
  className = "user-avatar",
  profile,
}: UserAvatarProps) {
  // The same fallback is used by both the generic Avatar and custom child markup.
  const fallback = getUserInitial(profile);

  return (
    // aria-hidden avoids repeating the adjacent visible user name.
    <Avatar aria-hidden="true" className={className} fallback={fallback}>
      {profile.avatarUrl ? (
        <span className="user-avatar-stage" style={getAvatarStageStyle(profile)}>
          <img
            alt=""
            className="user-avatar-stage-image"
            draggable={false}
            src={profile.avatarUrl}
            style={getAvatarImageStyle(profile)}
          />
        </span>
      ) : (
        // Initials remain visible when no uploaded avatar exists.
        <span className="user-avatar-initial">{fallback}</span>
      )}
    </Avatar>
  );
}
