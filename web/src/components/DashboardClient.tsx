"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { AppLogo } from "@/components/AppLogo";
import { AssetChart } from "@/components/AssetChart";
import { FooterLinks } from "@/components/FooterLinks";
import { ProfileSettingsDialog } from "@/components/ProfileSettingsDialog";
import { UserAvatar } from "@/components/UserAvatar";
import { WatchlistNav } from "@/components/WatchlistNav";
import { LanguageSelect } from "@/components/ui/LanguageSelect";
import { ThemeSwitch } from "@/components/ui/ThemeSwitch";
import type { WatchlistAsset } from "@/lib/assets";
import type { UserProfile } from "@/lib/profile-types";
import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";

type DashboardClientProps = {
  userProfile: UserProfile;
  watchlistAssets: WatchlistAsset[];
};

export function DashboardClient({
  userProfile,
  watchlistAssets: initialWatchlistAssets,
}: DashboardClientProps) {
  const t = useTranslations("dashboard");
  const commonT = useTranslations("common");
  const userMenuRef = useRef<HTMLDetailsElement>(null);
  const [profile, setProfile] = useState(userProfile);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [watchlistAssets, setWatchlistAssets] = useState(initialWatchlistAssets);
  const [selectedSymbol, setSelectedSymbol] = useState(
    initialWatchlistAssets[0]?.symbol ?? null
  );
  const [isLoggingOut, startLogoutTransition] = useTransition();
  const selectedAsset = useMemo(
    () =>
      watchlistAssets.find((asset) => asset.symbol === selectedSymbol) ??
      watchlistAssets[0] ??
      null,
    [selectedSymbol, watchlistAssets]
  );

  function addWatchlistAsset(asset: WatchlistAsset) {
    setWatchlistAssets((currentAssets) => {
      if (
        currentAssets.some((currentAsset) => currentAsset.symbol === asset.symbol)
      ) {
        return currentAssets;
      }

      return [...currentAssets, asset];
    });
  }

  function handleLogout() {
    startLogoutTransition(async () => {
      await fetch("/api/auth/logout", {
        method: "POST",
      }).catch(() => null);

      await signOut({
        callbackUrl: "/login",
        redirect: true,
      });
    });
  }

  function handleOpenProfileDialog() {
    userMenuRef.current?.removeAttribute("open");
    setIsProfileDialogOpen(true);
  }

  const footerItems = [
    {
      href: "/privacy",
      label: commonT("privacy"),
    },
    {
      href: "/terms",
      label: commonT("terms"),
    },
  ];

  return (
    <main className="app-shell">
      <input
        className="mobile-drawer-toggle"
        id="dashboard-drawer"
        type="checkbox"
      />

      <aside className="app-sidebar app-sidebar-desktop">
        <AppLogo
          ariaLabel={t("logoAria")}
          href="/dashboard"
          size="small"
        />

        <WatchlistNav
          assets={watchlistAssets}
          onAssetAdd={addWatchlistAsset}
          onSelectSymbol={setSelectedSymbol}
          selectedSymbol={selectedAsset?.symbol ?? null}
        />

        <FooterLinks className="sidebar-footer-links" items={footerItems} />
      </aside>

      <label
        aria-hidden="true"
        className="mobile-drawer-backdrop"
        htmlFor="dashboard-drawer"
      />

      <aside className="mobile-drawer">
        <AppLogo
          ariaLabel={t("logoAria")}
          href="/dashboard"
          size="small"
        />

        <WatchlistNav
          assets={watchlistAssets}
          mobile
          onAssetAdd={addWatchlistAsset}
          onSelectSymbol={setSelectedSymbol}
          selectedSymbol={selectedAsset?.symbol ?? null}
        />

        <FooterLinks className="sidebar-footer-links" items={footerItems} />
      </aside>

      <section className="app-content">
        <header className="dashboard-header">
          <div className="dashboard-title">
            <label
              aria-label={t("openWatchlist")}
              className="mobile-menu-button"
              htmlFor="dashboard-drawer"
            >
              <span aria-hidden="true" className="mobile-menu-icon" />
            </label>

            <div>
              <h1 className="text-3xl font-semibold">{t("overview")}</h1>
            </div>
          </div>

          <details className="user-menu" ref={userMenuRef}>
            <summary
              aria-label={t("openUserMenu", {
                name: profile.displayName,
              })}
              className="user-menu-trigger"
            >
              <UserAvatar className="user-menu-avatar" profile={profile} />
            </summary>
            <div className="user-menu-panel">
              <p className="user-menu-name">{profile.displayName}</p>
              <p className="user-menu-email">{profile.email}</p>

              <button
                className="user-menu-action"
                onClick={handleOpenProfileDialog}
                type="button"
              >
                {t("profileSettings")}
              </button>

              <div className="user-menu-row">
                <span>{t("theme")}</span>
                <ThemeSwitch />
              </div>

              <div className="user-menu-row">
                <LanguageSelect className="language-select language-select-menu" />
              </div>

              <div className="user-menu-form">
                <button
                  className="user-menu-action"
                  disabled={isLoggingOut}
                  onClick={handleLogout}
                  type="button"
                >
                  {isLoggingOut ? t("loggingOut") : t("logout")}
                </button>
              </div>
            </div>
          </details>
        </header>

        <div className="dashboard-grid mt-8 grid flex-1 gap-6">
          <AssetChart asset={selectedAsset} />

          <aside className="dashboard-summary-grid">
            <div className="app-card p-4">
              <p className="app-eyebrow">{t("trend")}</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--app-accent)]">
                {t("trendNeutral")}
              </p>
            </div>

            <div className="app-card p-4">
              <p className="app-eyebrow">{t("sentiment")}</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--app-secondary)]">
                {t("sentimentPending")}
              </p>
            </div>
          </aside>
        </div>
      </section>

      {isProfileDialogOpen ? (
        <ProfileSettingsDialog
          onClose={() => setIsProfileDialogOpen(false)}
          onProfileSave={setProfile}
          profile={profile}
        />
      ) : null}
    </main>
  );
}
