/* eslint-disable @next/next/no-img-element */

import type { CSSProperties } from "react";
import { getAvatarCropRatio } from "@/lib/profile-rules";
export { getDefaultAvatarScale } from "@/lib/profile-rules";

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
  return Number.isFinite(value) ? value : fallback;
}

export function getUserInitial(
  profile: Pick<AvatarProfile, "displayName" | "email">
) {
  const source = profile.displayName || profile.email;

  return source.trim().slice(0, 1).toUpperCase() || "?";
}

export function getAvatarImageStyle(
  profile: Pick<AvatarProfile, "avatarScale">
): CSSProperties {
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
  const offsetX = safeNumber(profile.avatarOffsetX, 0);
  const offsetY = safeNumber(profile.avatarOffsetY, 0);
  const cropRatio = getAvatarCropRatio(profile.avatarScale);

  return {
    "--avatar-crop-ratio": cropRatio,
    transform: `translate(-50%, -50%) translate(${offsetX}%, ${offsetY}%)`,
  } as CSSProperties;
}

export function getAvatarCropStageStyle(
  profile: Pick<AvatarProfile, "avatarScale">
): CSSProperties {
  return {
    "--avatar-crop-ratio": getAvatarCropRatio(profile.avatarScale),
  } as CSSProperties;
}

export function UserAvatar({
  className = "user-avatar",
  profile,
}: UserAvatarProps) {
  return (
    <span aria-hidden="true" className={className}>
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
        <span className="user-avatar-initial">{getUserInitial(profile)}</span>
      )}
    </span>
  );
}
