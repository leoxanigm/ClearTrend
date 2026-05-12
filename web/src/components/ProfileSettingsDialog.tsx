"use client";

/* eslint-disable @next/next/no-img-element */

import {
  type ChangeEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getAvatarCropStageStyle,
  getAvatarImageStyle,
  getAvatarStageStyle,
  getDefaultAvatarScale,
  UserAvatar,
} from "@/components/UserAvatar";
import {
  avatarUploadRules,
  clampAvatarOffsetForScale,
  clampAvatarScale,
  displayNameLimits,
  getAvatarCropRatio,
  getAvatarMaxOffset,
  normalizeDisplayName,
  validateDisplayName,
} from "@/lib/profile-rules";
import type { UserProfile } from "@/lib/profile-types";

type ProfileSettingsDialogProps = {
  onClose: () => void;
  onProfileSave: (profile: UserProfile) => void;
  profile: UserProfile;
};

type ProfileResponse = {
  error?: string;
  profile?: UserProfile;
};

type DragState = {
  height: number;
  offsetX: number;
  offsetY: number;
  pointerId: number;
  startX: number;
  startY: number;
  width: number;
};

const allowedAvatarMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function formatMegabytes(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function hasNumberChanged(currentValue: number, nextValue: number) {
  return Math.abs(currentValue - nextValue) > 0.001;
}

export function ProfileSettingsDialog({
  onClose,
  onProfileSave,
  profile,
}: ProfileSettingsDialogProps) {
  const displayNameId = useId();
  const avatarInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const localPreviewUrlRef = useRef<string | null>(null);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [avatarScale, setAvatarScale] = useState(profile.avatarScale);
  const [avatarOffsetX, setAvatarOffsetX] = useState(profile.avatarOffsetX);
  const [avatarOffsetY, setAvatarOffsetY] = useState(profile.avatarOffsetY);
  const [isCropEditorOpen, setIsCropEditorOpen] = useState(false);
  const [cropDraftScale, setCropDraftScale] = useState(profile.avatarScale);
  const [cropDraftOffsetX, setCropDraftOffsetX] = useState(
    profile.avatarOffsetX
  );
  const [cropDraftOffsetY, setCropDraftOffsetY] = useState(
    profile.avatarOffsetY
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const previewAvatarUrl = removeAvatar
    ? null
    : localPreviewUrl ?? profile.avatarUrl;
  const profileWithPreview = {
    ...profile,
    avatarOffsetX,
    avatarOffsetY,
    avatarScale,
    avatarUrl: previewAvatarUrl,
    displayName,
  };
  const profileWithCropDraft = {
    ...profileWithPreview,
    avatarOffsetX: cropDraftOffsetX,
    avatarOffsetY: cropDraftOffsetY,
    avatarScale: cropDraftScale,
  };
  const hasAvatar = Boolean(previewAvatarUrl);
  const isCropMovable = getAvatarMaxOffset(cropDraftScale) > 0;
  const normalizedDisplayName = normalizeDisplayName(displayName);
  const hasChanges = useMemo(() => {
    const cropChanged =
      hasNumberChanged(profile.avatarScale, avatarScale) ||
      hasNumberChanged(profile.avatarOffsetX, avatarOffsetX) ||
      hasNumberChanged(profile.avatarOffsetY, avatarOffsetY);

    return (
      normalizedDisplayName !== profile.displayName ||
      Boolean(selectedFile) ||
      removeAvatar ||
      (Boolean(profile.avatarUrl) && cropChanged)
    );
  }, [
    avatarOffsetX,
    avatarOffsetY,
    avatarScale,
    normalizedDisplayName,
    profile.avatarOffsetX,
    profile.avatarOffsetY,
    profile.avatarScale,
    profile.avatarUrl,
    profile.displayName,
    removeAvatar,
    selectedFile,
  ]);

  useEffect(() => {
    return () => {
      if (localPreviewUrlRef.current) {
        URL.revokeObjectURL(localPreviewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isCropEditorOpen) {
        setIsCropEditorOpen(false);
        return;
      }

      if (event.key === "Escape" && !isSaving) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCropEditorOpen, isSaving, onClose]);

  function resetCrop() {
    setAvatarOffsetX(0);
    setAvatarOffsetY(0);
    setAvatarScale(getDefaultAvatarScale());
    setCropDraftOffsetX(0);
    setCropDraftOffsetY(0);
    setCropDraftScale(getDefaultAvatarScale());
  }

  function setCropDraftScaleValue(nextValue: unknown) {
    const nextScale = clampAvatarScale(nextValue);

    setCropDraftScale(nextScale);
    setCropDraftOffsetX((currentOffset) =>
      clampAvatarOffsetForScale(currentOffset, nextScale)
    );
    setCropDraftOffsetY((currentOffset) =>
      clampAvatarOffsetForScale(currentOffset, nextScale)
    );
  }

  function openCropEditor() {
    if (!previewAvatarUrl) {
      return;
    }

    const nextScale = clampAvatarScale(avatarScale);

    setCropDraftOffsetX(clampAvatarOffsetForScale(avatarOffsetX, nextScale));
    setCropDraftOffsetY(clampAvatarOffsetForScale(avatarOffsetY, nextScale));
    setCropDraftScale(nextScale);
    setIsCropEditorOpen(true);
  }

  function saveCropDraft() {
    const nextScale = clampAvatarScale(cropDraftScale);

    setAvatarOffsetX(clampAvatarOffsetForScale(cropDraftOffsetX, nextScale));
    setAvatarOffsetY(clampAvatarOffsetForScale(cropDraftOffsetY, nextScale));
    setAvatarScale(nextScale);
    setIsCropEditorOpen(false);
  }

  function clearLocalPreviewUrl() {
    if (localPreviewUrlRef.current) {
      URL.revokeObjectURL(localPreviewUrlRef.current);
      localPreviewUrlRef.current = null;
    }

    setLocalPreviewUrl(null);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    if (!allowedAvatarMimeTypes.has(file.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }

    if (file.size > avatarUploadRules.maxSize) {
      setError(
        `Avatar must be ${formatMegabytes(avatarUploadRules.maxSize)} or smaller.`
      );
      return;
    }

    setError(null);
    setRemoveAvatar(false);
    clearLocalPreviewUrl();
    const nextPreviewUrl = URL.createObjectURL(file);
    localPreviewUrlRef.current = nextPreviewUrl;
    setLocalPreviewUrl(nextPreviewUrl);
    setSelectedFile(file);
    resetCrop();
    setIsCropEditorOpen(true);
  }

  function handleRemoveAvatar() {
    setSelectedFile(null);
    clearLocalPreviewUrl();
    setRemoveAvatar(true);
    setIsCropEditorOpen(false);
    setError(null);
    resetCrop();
  }

  function handleBackdropPointerDown(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    if (event.target === event.currentTarget && !isSaving) {
      onClose();
    }
  }

  function handleCropBackdropPointerDown(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    if (event.target === event.currentTarget) {
      setIsCropEditorOpen(false);
    }
  }

  function handleAvatarPointerDown(
    event: ReactPointerEvent<HTMLElement>
  ) {
    if (!hasAvatar || !previewRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (getAvatarMaxOffset(cropDraftScale) <= 0) {
      setCropDraftOffsetX(0);
      setCropDraftOffsetY(0);
      return;
    }

    const rect = previewRef.current.getBoundingClientRect();
    dragStateRef.current = {
      height: rect.height,
      offsetX: cropDraftOffsetX,
      offsetY: cropDraftOffsetY,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      width: rect.width,
    };

    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function handleAvatarPointerMove(
    event: ReactPointerEvent<HTMLElement>
  ) {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();

    const cropRatio = Math.max(getAvatarCropRatio(cropDraftScale), 0.001);
    const deltaX =
      ((event.clientX - dragState.startX) / (dragState.width * cropRatio)) *
      100;
    const deltaY =
      ((event.clientY - dragState.startY) / (dragState.height * cropRatio)) *
      100;

    setCropDraftOffsetX(
      clampAvatarOffsetForScale(dragState.offsetX + deltaX, cropDraftScale)
    );
    setCropDraftOffsetY(
      clampAvatarOffsetForScale(dragState.offsetY + deltaY, cropDraftScale)
    );
  }

  function handleAvatarPointerUp(event: ReactPointerEvent<HTMLElement>) {
    if (dragStateRef.current?.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasChanges) {
      onClose();
      return;
    }

    const validation = validateDisplayName(displayName);

    if (validation.error || !validation.value) {
      setError(validation.error ?? "Invalid display name.");
      return;
    }

    const nextAvatarScale = clampAvatarScale(avatarScale);
    const nextAvatarOffsetX = clampAvatarOffsetForScale(
      avatarOffsetX,
      nextAvatarScale
    );
    const nextAvatarOffsetY = clampAvatarOffsetForScale(
      avatarOffsetY,
      nextAvatarScale
    );
    const formData = new FormData();
    formData.set("displayName", validation.value);
    formData.set("avatarScale", String(nextAvatarScale));
    formData.set("avatarOffsetX", String(nextAvatarOffsetX));
    formData.set("avatarOffsetY", String(nextAvatarOffsetY));
    formData.set("removeAvatar", String(removeAvatar));

    if (selectedFile) {
      formData.set("avatar", selectedFile);
    }

    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/profile", {
        body: formData,
        method: "PATCH",
      });
      const body = (await response.json().catch(() => null)) as
        | ProfileResponse
        | null;

      if (!response.ok || !body?.profile) {
        setError(body?.error ?? "Profile could not be saved.");
        return;
      }

      onProfileSave(body.profile);
      onClose();
    } catch {
      setError("Profile could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="profile-dialog-backdrop"
      onPointerDown={handleBackdropPointerDown}
    >
      <form
        aria-labelledby="profile-dialog-title"
        aria-modal="true"
        className="profile-dialog"
        onSubmit={handleSubmit}
        role="dialog"
      >
        <header className="profile-dialog-header">
          <div>
            <h2 className="profile-dialog-title" id="profile-dialog-title">
              Profile settings
            </h2>
            <p className="profile-dialog-email">{profile.email}</p>
          </div>

          <button
            aria-label="Close profile settings"
            className="profile-dialog-close"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true" className="profile-dialog-close-icon" />
          </button>
        </header>

        <div className="profile-dialog-body">
          <section className="profile-section profile-avatar-section">
            <div className="profile-avatar-summary">
              <div className="profile-avatar-preview-shell">
                <button
                  aria-label="Edit profile photo crop"
                  className="profile-avatar-preview"
                  disabled={!hasAvatar}
                  onClick={openCropEditor}
                  type="button"
                >
                  <UserAvatar
                    className="profile-avatar-preview-media"
                    profile={profileWithPreview}
                  />
                </button>
                <button
                  aria-label="Choose profile image"
                  className="profile-avatar-upload-button"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  <span aria-hidden="true" className="profile-plus-icon" />
                </button>
              </div>

              <div className="profile-avatar-actions">
                <button
                  className="outline-button profile-inline-button"
                  disabled={!hasAvatar && !profile.avatarUrl}
                  onClick={handleRemoveAvatar}
                  type="button"
                >
                  Remove
                </button>
                <input
                  accept={avatarUploadRules.accept}
                  className="profile-file-input"
                  id={avatarInputId}
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  type="file"
                />
              </div>
            </div>
          </section>

          <section className="profile-section">
            <label className="form-field" htmlFor={displayNameId}>
              <span className="form-label">Display name</span>
              <input
                className="form-input"
                id={displayNameId}
                maxLength={displayNameLimits.max}
                minLength={displayNameLimits.min}
                onChange={(event) => setDisplayName(event.target.value)}
                value={displayName}
              />
            </label>
          </section>

          <section className="profile-section">
            <h3 className="profile-section-title">Watchlist</h3>
            <div className="profile-watchlist-actions">
              <button
                className="outline-button profile-inline-button"
                disabled
                type="button"
              >
                Download CSV/JSON
              </button>
              <button
                className="outline-button profile-inline-button"
                disabled
                type="button"
              >
                Upload CSV/JSON
              </button>
              <button
                className="outline-button profile-inline-button"
                disabled
                type="button"
              >
                Import CSV/JSON
              </button>
            </div>
          </section>

          {error ? (
            <p className="form-message form-message-error">{error}</p>
          ) : null}
        </div>

        <footer className="profile-dialog-footer">
          <button
            className="outline-button profile-footer-button"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="primary-button profile-footer-button"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Saving..." : "Save changes"}
          </button>
        </footer>

        {isCropEditorOpen && previewAvatarUrl ? (
          <div
            className="profile-crop-backdrop"
            onPointerDown={handleCropBackdropPointerDown}
          >
            <section
              aria-label="Edit profile photo crop"
              aria-modal="true"
              className="profile-crop-dialog"
              role="dialog"
            >
              <header className="profile-crop-header">
                <h3 className="profile-crop-title">Edit photo</h3>
                <button
                  aria-label="Close photo editor"
                  className="profile-dialog-close"
                  onClick={() => setIsCropEditorOpen(false)}
                  type="button"
                >
                  <span aria-hidden="true" className="profile-dialog-close-icon" />
                </button>
              </header>

              <div className="profile-crop-editor">
                <div
                  aria-label="Move profile photo behind the crop circle"
                  className={`profile-crop-stage${
                    isCropMovable ? " profile-crop-stage-movable" : ""
                  }`}
                  onDragStart={(event) => event.preventDefault()}
                  onPointerCancel={handleAvatarPointerUp}
                  onPointerDown={handleAvatarPointerDown}
                  onPointerMove={handleAvatarPointerMove}
                  onPointerUp={handleAvatarPointerUp}
                  ref={previewRef}
                  role="application"
                  style={getAvatarCropStageStyle(profileWithCropDraft)}
                >
                  <div
                    className="profile-crop-stage-frame"
                    style={getAvatarStageStyle(profileWithCropDraft)}
                  >
                    <img
                      alt=""
                      className="profile-crop-stage-image"
                      draggable={false}
                      src={previewAvatarUrl}
                      style={getAvatarImageStyle(profileWithCropDraft)}
                    />
                  </div>
                  <div aria-hidden="true" className="profile-crop-target" />
                </div>

                <div className="profile-zoom-control">
                  <button
                    aria-label="Zoom out"
                    className="profile-zoom-button"
                    disabled={cropDraftScale <= 1}
                    onClick={() =>
                      setCropDraftScaleValue(cropDraftScale - 0.05)
                    }
                    type="button"
                  >
                    <span aria-hidden="true" className="profile-minus-icon" />
                  </button>
                  <input
                    aria-label="Profile photo zoom"
                    max="2.5"
                    min="1"
                    onChange={(event) =>
                      setCropDraftScaleValue(event.target.value)
                    }
                    step="0.05"
                    type="range"
                    value={cropDraftScale}
                  />
                  <button
                    aria-label="Zoom in"
                    className="profile-zoom-button"
                    disabled={cropDraftScale >= 2.5}
                    onClick={() =>
                      setCropDraftScaleValue(cropDraftScale + 0.05)
                    }
                    type="button"
                  >
                    <span aria-hidden="true" className="profile-plus-icon" />
                  </button>
                  <span className="profile-zoom-value">
                    {Math.round(cropDraftScale * 100)}%
                  </span>
                  <button
                    className="primary-button profile-crop-save-button"
                    onClick={saveCropDraft}
                    type="button"
                  >
                    Save
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </form>
    </div>
  );
}
