"use client";

import { useMemo, useState, useTransition } from "react";
import { AppLogo } from "@/components/AppLogo";
import { AssetChart } from "@/components/AssetChart";
import { FooterLinks } from "@/components/FooterLinks";
import { WatchlistNav } from "@/components/WatchlistNav";
import { ThemeSwitch } from "@/components/ui/ThemeSwitch";
import type { WatchlistAsset } from "@/lib/assets";
import { signOut } from "next-auth/react";

type DashboardClientProps = {
  userEmail: string;
  userInitial: string;
  userName: string;
  watchlistAssets: WatchlistAsset[];
};

const footerItems = [
  {
    href: "/privacy",
    label: "Privacy",
  },
  {
    href: "/terms",
    label: "Terms",
  },
];

export function DashboardClient({
  userEmail,
  userInitial,
  userName,
  watchlistAssets: initialWatchlistAssets,
}: DashboardClientProps) {
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
      if (currentAssets.some((currentAsset) => currentAsset.symbol === asset.symbol)) {
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

  return (
    <main className="app-shell">
      <input
        className="mobile-drawer-toggle"
        id="dashboard-drawer"
        type="checkbox"
      />

      <aside className="app-sidebar app-sidebar-desktop">
        <AppLogo
          ariaLabel="ClearTrend dashboard"
          href="/dashboard"
          size="small"
        />

        <WatchlistNav
          assets={watchlistAssets}
          onAssetAdd={addWatchlistAsset}
          onSelectSymbol={setSelectedSymbol}
          selectedSymbol={selectedAsset?.symbol ?? null}
        />

        <FooterLinks className="mt-auto flex gap-3 text-xs" items={footerItems} />
      </aside>

      <label
        aria-hidden="true"
        className="mobile-drawer-backdrop"
        htmlFor="dashboard-drawer"
      />

      <aside className="mobile-drawer">
        <AppLogo
          ariaLabel="ClearTrend dashboard"
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

        <FooterLinks className="mt-auto flex gap-3 text-xs" items={footerItems} />
      </aside>

      <section className="app-content">
        <header className="dashboard-header">
          <div className="dashboard-title">
            <label
              aria-label="Open watchlist"
              className="mobile-menu-button"
              htmlFor="dashboard-drawer"
            >
              <span aria-hidden="true" className="mobile-menu-icon" />
            </label>

            <div>
              <h1 className="text-3xl font-semibold">Overview</h1>
            </div>
          </div>

          <details className="user-menu">
            <summary aria-label="Open user menu" className="user-menu-trigger">
              {userInitial}
            </summary>
            <div className="user-menu-panel">
              <p className="user-menu-name">{userName}</p>
              <p className="user-menu-email">{userEmail}</p>

              <div className="user-menu-row">
                <span>Theme</span>
                <ThemeSwitch />
              </div>

              <div className="user-menu-form">
                <button
                  className="user-menu-action"
                  disabled={isLoggingOut}
                  onClick={handleLogout}
                  type="button"
                >
                  {isLoggingOut ? "Logging out..." : "Logout"}
                </button>
              </div>
            </div>
          </details>
        </header>

        <div className="dashboard-grid mt-8 grid flex-1 gap-6">
          <AssetChart asset={selectedAsset} />

          <aside className="dashboard-summary-grid">
            <div className="app-card p-4">
              <p className="app-eyebrow">Trend</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--app-accent)]">
                Neutral
              </p>
            </div>

            <div className="app-card p-4">
              <p className="app-eyebrow">Sentiment</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--app-secondary)]">
                Pending
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
