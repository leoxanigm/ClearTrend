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
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Modal } from "@/components/ui/Modal";
import { TextInput } from "@/components/ui/TextInput";
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
import { useNotifications } from "@/components/ui/Notifications";
import type { UserProfile } from "@/lib/profile-types";
import {
  validateWatchlistFile,
  watchlistFileRules,
} from "@/lib/watchlist-file";
import { useTranslations } from "next-intl";

type ProfileSettingsDialogProps = {
  onClose: () => void;
  onProfileSave: (profile: UserProfile) => void;
  onWatchlistImport: () => void;
  profile: UserProfile;
};

type ProfileResponse = {
  error?: string;
  profile?: UserProfile;
};

type WatchlistImportResponse = {
  error?: string;
  ignoredSymbols?: string[];
  importedSymbols?: string[];
  invalidEntries?: number;
};

type WatchlistPreview = {
  file: File;
  invalidEntries: number;
  symbols: string[];
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

const allowedAvatarMimeTypes = new Set(avatarUploadRules.allowedMimeTypes);

function formatMegabytes(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function hasNumberChanged(currentValue: number, nextValue: number) {
  return Math.abs(currentValue - nextValue) > 0.001;
}

export function ProfileSettingsDialog({
  onClose,
  onProfileSave,
  onWatchlistImport,
  profile,
}: ProfileSettingsDialogProps) {
  const t = useTranslations("profile");
  const commonT = useTranslations("common");
  const { notify } = useNotifications();
  const displayNameId = useId();
  const avatarInputId = useId();
  const watchlistInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const watchlistFileInputRef = useRef<HTMLInputElement>(null);
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
  const [avatarUploadProgress, setAvatarUploadProgress] = useState(0);
  const [isWatchlistExporting, setIsWatchlistExporting] = useState(false);
  const [isWatchlistImporting, setIsWatchlistImporting] = useState(false);
  const [watchlistImportProgress, setWatchlistImportProgress] = useState(0);
  const [watchlistPreview, setWatchlistPreview] =
    useState<WatchlistPreview | null>(null);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const isDialogBusy =
    isSaving || isWatchlistExporting || isWatchlistImporting;
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

      if (event.key === "Escape" && !isDialogBusy) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCropEditorOpen, isDialogBusy, onClose]);

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
      setError(t("errors.imageType"));
      return;
    }

    if (file.size > avatarUploadRules.maxSize) {
      setError(
        t("errors.tooLarge", {
          size: formatMegabytes(avatarUploadRules.maxSize),
        })
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

  async function handleWatchlistFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    if (
      file.type !== "application/json" ||
      !file.name.toLowerCase().endsWith(".json")
    ) {
      setWatchlistPreview(null);
      setWatchlistError(t("watchlistFile.errors.type"));
      return;
    }

    if (file.size <= 0 || file.size > watchlistFileRules.maxSize) {
      setWatchlistPreview(null);
      setWatchlistError(t("watchlistFile.errors.size"));
      return;
    }

    const payload = await file.text()
      .then((text) => JSON.parse(text) as unknown)
      .catch(() => null);

    if (payload === null) {
      setWatchlistPreview(null);
      setWatchlistError(t("watchlistFile.errors.invalidJson"));
      return;
    }

    const validation = validateWatchlistFile(payload);

    if (validation.error) {
      setWatchlistPreview(null);
      setWatchlistError(t("watchlistFile.errors.format"));
      return;
    }

    setWatchlistError(null);
    setWatchlistPreview({
      file,
      invalidEntries: validation.invalidEntries,
      symbols: validation.symbols,
    });
  }

  async function handleWatchlistExport() {
    setWatchlistError(null);
    setIsWatchlistExporting(true);

    try {
      const response = await fetch("/api/assets/watchlist/file", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Watchlist export failed");
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const disposition = response.headers.get("content-disposition") ?? "";
      const fileName = disposition.match(/filename="([^"]+)"/)?.[1] ??
        "cleartrend-watchlist.json";

      link.href = downloadUrl;
      link.download = fileName;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
      notify({
        title: t("watchlistFile.exported"),
        tone: "success",
      });
    } catch {
      setWatchlistError(t("watchlistFile.errors.export"));
    } finally {
      setIsWatchlistExporting(false);
    }
  }

  async function handleWatchlistImport() {
    if (!watchlistPreview) {
      return;
    }

    setWatchlistError(null);
    setWatchlistImportProgress(0);
    setIsWatchlistImporting(true);

    const formData = new FormData();
    formData.set("watchlist", watchlistPreview.file);

    try {
      const result = await new Promise<{
        body: WatchlistImportResponse | null;
        status: number;
      }>((resolve, reject) => {
        const request = new XMLHttpRequest();

        request.open("POST", "/api/assets/watchlist/file");
        request.responseType = "json";
        request.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            setWatchlistImportProgress(
              Math.round((event.loaded / event.total) * 100)
            );
          }
        });
        request.addEventListener("load", () => {
          resolve({
            body: request.response as WatchlistImportResponse | null,
            status: request.status,
          });
        });
        request.addEventListener("error", () => reject(new Error("Upload failed")));
        request.send(formData);
      });

      if (result.status < 200 || result.status >= 300) {
        throw new Error(result.body?.error ?? "Watchlist import failed");
      }

      const importedCount = result.body?.importedSymbols?.length ?? 0;
      const ignoredCount =
        (result.body?.ignoredSymbols?.length ?? 0) +
        (result.body?.invalidEntries ?? 0);

      setWatchlistImportProgress(100);
      setWatchlistPreview(null);
      onWatchlistImport();
      notify({
        body: ignoredCount > 0
          ? t("watchlistFile.importResultWithIgnored", {
              ignored: ignoredCount,
              imported: importedCount,
            })
          : t("watchlistFile.importResult", { imported: importedCount }),
        title: t("watchlistFile.imported"),
        tone: "success",
      });
    } catch {
      setWatchlistError(t("watchlistFile.errors.import"));
    } finally {
      setIsWatchlistImporting(false);
    }
  }

  function handleBackdropPointerDown(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    if (event.target === event.currentTarget && !isDialogBusy) {
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
      setError(translateDisplayNameError(validation.error));
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
    setAvatarUploadProgress(0);

    try {
      const result = await new Promise<{
        body: ProfileResponse | null;
        status: number;
      }>((resolve, reject) => {
        const request = new XMLHttpRequest();

        request.open("PATCH", "/api/profile");
        request.responseType = "json";

        if (selectedFile) {
          request.upload.addEventListener("progress", (uploadEvent) => {
            if (uploadEvent.lengthComputable) {
              setAvatarUploadProgress(
                Math.round((uploadEvent.loaded / uploadEvent.total) * 100)
              );
            }
          });
        }

        request.addEventListener("load", () => {
          resolve({
            body: request.response as ProfileResponse | null,
            status: request.status,
          });
        });
        request.addEventListener("error", () =>
          reject(new Error("Profile upload failed"))
        );
        request.send(formData);
      });
      const body = result.body;

      if (result.status < 200 || result.status >= 300 || !body?.profile) {
        const message = translateProfileError(body?.error);

        setError(message);
        notify({
          body: message,
          title: "Profile update failed",
          tone: "error",
        });
        return;
      }

      onProfileSave(body.profile);
      setAvatarUploadProgress(100);
      notify({
        title: "Profile updated",
        tone: "success",
      });
      onClose();
    } catch {
      const message = t("errors.profileSave");

      setError(message);
      notify({
        body: message,
        title: "Profile update failed",
        tone: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  function translateDisplayNameError(error: string | null | undefined) {
    const messages: Record<string, string> = {
      "Display name contains unsupported characters.": t(
        "errors.displayNameUnsupported"
      ),
      "Display name must be 32 characters or fewer.": t(
        "errors.displayNameMax"
      ),
      "Display name must be at least 3 characters.": t("errors.displayNameMin"),
      "Display name must include at least one letter or number.": t(
        "errors.displayNameLetters"
      ),
    };

    return error
      ? messages[error] ?? t("errors.displayNameInvalid")
      : t("errors.displayNameInvalid");
  }

  function translateProfileError(error: unknown) {
    if (typeof error !== "string") {
      return t("errors.profileSave");
    }

    const messages: Record<string, string> = {
      "Avatar must be 5 MB or smaller.": t("errors.tooLarge", {
        size: formatMegabytes(avatarUploadRules.maxSize),
      }),
      "Avatar must be a JPEG, PNG, or WebP image.": t("errors.imageType"),
      "Avatar file content does not match its image type.": t("errors.imageType"),
      "Avatar file is empty.": t("errors.imageType"),
      "Animated avatars are not supported.": t("errors.animatedImage"),
      "Avatar dimensions exceed the safe processing limit.": t(
        "errors.dimensionsTooLarge"
      ),
      "Avatar dimensions must be at least 64 by 64 pixels.": t(
        "errors.dimensionsTooSmall"
      ),
      "Avatar image could not be processed.": t("errors.imageInvalid"),
      "Invalid display name.": t("errors.displayNameInvalid"),
      "Profile could not be saved.": t("errors.profileSave"),
    };

    return messages[error] ?? translateDisplayNameError(error);
  }

  return (
    <Modal
      ariaLabelledBy="profile-dialog-title"
      as="form"
      backdropClassName="profile-dialog-backdrop"
      className="profile-dialog"
      onBackdropPointerDown={handleBackdropPointerDown}
      onSubmit={handleSubmit}
    >
        <header className="profile-dialog-header">
          <div>
            <h2 className="profile-dialog-title" id="profile-dialog-title">
              {t("title")}
            </h2>
            <p className="profile-dialog-email">{profile.email}</p>
          </div>

          <IconButton
            className="profile-dialog-close"
            disabled={isDialogBusy}
            label={t("aria.closeSettings")}
            onClick={onClose}
          >
            <span aria-hidden="true" className="profile-dialog-close-icon" />
          </IconButton>
        </header>

        <div className="profile-dialog-body">
          <section className="profile-section profile-avatar-section">
            <div className="profile-avatar-summary">
              <div className="profile-avatar-preview-shell">
                <button
                  aria-label={t("aria.editCrop")}
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
                <IconButton
                  className="profile-avatar-upload-button"
                  disabled={isDialogBusy}
                  label={t("aria.chooseImage")}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span aria-hidden="true" className="profile-plus-icon" />
                </IconButton>
              </div>

              <div className="profile-avatar-actions">
                <Button
                  className="profile-inline-button"
                  disabled={
                    isDialogBusy || (!hasAvatar && !profile.avatarUrl)
                  }
                  onClick={handleRemoveAvatar}
                  variant="outline"
                >
                  {t("buttons.remove")}
                </Button>
                <input
                  accept={avatarUploadRules.accept}
                  className="profile-file-input"
                  id={avatarInputId}
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  type="file"
                />
              </div>
              {isSaving && selectedFile ? (
                <progress
                  aria-label={t("avatarUploadProgress")}
                  className="profile-upload-progress"
                  max="100"
                  value={avatarUploadProgress}
                />
              ) : null}
            </div>
          </section>

          <section className="profile-section">
            <TextInput
              id={displayNameId}
              label={t("displayName")}
              maxLength={displayNameLimits.max}
              minLength={displayNameLimits.min}
              onChange={(event) => setDisplayName(event.target.value)}
              value={displayName}
            />
          </section>

          <section className="profile-section">
            <h3 className="profile-section-title">{t("watchlist")}</h3>
            <div className="profile-watchlist-actions">
              <Button
                className="profile-inline-button"
                disabled={isWatchlistExporting || isWatchlistImporting}
                onClick={() => void handleWatchlistExport()}
                variant="outline"
              >
                {isWatchlistExporting
                  ? t("watchlistFile.exporting")
                  : t("buttons.downloadWatchlist")}
              </Button>
              <Button
                className="profile-inline-button"
                disabled={isWatchlistImporting}
                onClick={() => watchlistFileInputRef.current?.click()}
                variant="outline"
              >
                {t("buttons.importWatchlist")}
              </Button>
              <input
                accept={watchlistFileRules.accept}
                className="profile-file-input"
                id={watchlistInputId}
                onChange={(event) => void handleWatchlistFileChange(event)}
                ref={watchlistFileInputRef}
                type="file"
              />
            </div>

            {watchlistPreview ? (
              <div className="profile-watchlist-preview">
                <p>
                  {t("watchlistFile.preview", {
                    count: watchlistPreview.symbols.length,
                  })}
                </p>
                <code>
                  {watchlistPreview.symbols.slice(0, 12).join(", ")}
                  {watchlistPreview.symbols.length > 12 ? ", ..." : ""}
                </code>
                {watchlistPreview.invalidEntries > 0 ? (
                  <p className="profile-watchlist-note">
                    {t("watchlistFile.invalidEntries", {
                      count: watchlistPreview.invalidEntries,
                    })}
                  </p>
                ) : null}
                {isWatchlistImporting ? (
                  <progress
                    aria-label={t("watchlistFile.progress")}
                    max="100"
                    value={watchlistImportProgress}
                  />
                ) : null}
                <div className="profile-watchlist-preview-actions">
                  <Button
                    disabled={isWatchlistImporting}
                    onClick={() => setWatchlistPreview(null)}
                    variant="outline"
                  >
                    {commonT("cancel")}
                  </Button>
                  <Button
                    disabled={isWatchlistImporting}
                    onClick={() => void handleWatchlistImport()}
                  >
                    {isWatchlistImporting
                      ? t("watchlistFile.importing")
                      : t("watchlistFile.confirmImport")}
                  </Button>
                </div>
              </div>
            ) : null}

            {watchlistError ? (
              <p className="form-message form-message-error">
                {watchlistError}
              </p>
            ) : null}
          </section>

          {error ? (
            <p className="form-message form-message-error">{error}</p>
          ) : null}
        </div>

        <footer className="profile-dialog-footer">
          <Button
            className="profile-footer-button"
            disabled={isDialogBusy}
            onClick={onClose}
            variant="outline"
          >
            {commonT("cancel")}
          </Button>
          <Button
            className="profile-footer-button"
            disabled={isDialogBusy}
            type="submit"
          >
            {isSaving ? commonT("saving") : commonT("saveChanges")}
          </Button>
        </footer>

        {isCropEditorOpen && previewAvatarUrl ? (
          <Modal
            ariaLabel={t("aria.editCrop")}
            backdropClassName="profile-crop-backdrop"
            className="profile-crop-dialog"
            onBackdropPointerDown={handleCropBackdropPointerDown}
          >
              <header className="profile-crop-header">
                <h3 className="profile-crop-title">{t("editPhoto")}</h3>
                <IconButton
                  className="profile-dialog-close"
                  label={t("aria.closeCrop")}
                  onClick={() => setIsCropEditorOpen(false)}
                >
                  <span aria-hidden="true" className="profile-dialog-close-icon" />
                </IconButton>
              </header>

              <div className="profile-crop-editor">
                <div
                  aria-label={t("aria.moveCrop")}
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
                  <IconButton
                    className="profile-zoom-button"
                    disabled={cropDraftScale <= 1}
                    label={t("aria.zoomOut")}
                    onClick={() =>
                      setCropDraftScaleValue(cropDraftScale - 0.05)
                    }
                  >
                    <span aria-hidden="true" className="profile-minus-icon" />
                  </IconButton>
                  <input
                    aria-label={t("aria.zoom")}
                    max="2.5"
                    min="1"
                    onChange={(event) =>
                      setCropDraftScaleValue(event.target.value)
                    }
                    step="0.05"
                    type="range"
                    value={cropDraftScale}
                  />
                  <IconButton
                    className="profile-zoom-button"
                    disabled={cropDraftScale >= 2.5}
                    label={t("aria.zoomIn")}
                    onClick={() =>
                      setCropDraftScaleValue(cropDraftScale + 0.05)
                    }
                  >
                    <span aria-hidden="true" className="profile-plus-icon" />
                  </IconButton>
                  <span className="profile-zoom-value">
                    {Math.round(cropDraftScale * 100)}%
                  </span>
                  <Button
                    className="profile-crop-save-button"
                    onClick={saveCropDraft}
                  >
                    {commonT("save")}
                  </Button>
                </div>
              </div>
          </Modal>
        ) : null}
    </Modal>
  );
}
