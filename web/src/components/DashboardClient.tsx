"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { AppLogo } from "@/components/AppLogo";
import { AssetChart } from "@/components/AssetChart";
import { FooterLinks } from "@/components/FooterLinks";
import { ProfileSettingsDialog } from "@/components/ProfileSettingsDialog";
import { useNotifications } from "@/components/ui/Notifications";
import { UserAvatar } from "@/components/UserAvatar";
import { WatchlistNav } from "@/components/WatchlistNav";
import { LanguageSelect } from "@/components/ui/LanguageSelect";
import { ThemeSwitch } from "@/components/ui/ThemeSwitch";
import type { WatchlistAsset } from "@/lib/assets";
import { isChartRange, type ChartRange } from "@/lib/analysis-data";
import type { UserProfile } from "@/lib/profile-types";
import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";

type DashboardClientProps = {
  initialRange?: string | null;
  initialSymbol?: string | null;
  userProfile: UserProfile;
  watchlistAssets: WatchlistAsset[];
};

type AssetSnapshotUpdate = {
  dayChangePercent: number | null;
  lastPrice: number | null;
  symbol: string;
};

const marketValueTolerance = 0.000001;

function assetSnapshotChanged(
  asset: WatchlistAsset | undefined,
  snapshot: AssetSnapshotUpdate
) {
  if (!asset || asset.isStale) {
    return false;
  }

  const changed = (currentValue: number | null, nextValue: number | null) =>
    nextValue !== null &&
    currentValue !== null &&
    Math.abs(currentValue - nextValue) > marketValueTolerance;

  return changed(asset.lastPrice, snapshot.lastPrice) ||
    changed(asset.dayChangePercent, snapshot.dayChangePercent);
}

function mergeSnapshotIntoAssets(
  assets: WatchlistAsset[],
  snapshot: AssetSnapshotUpdate
) {
  return assets.map((asset) =>
    asset.symbol === snapshot.symbol
      ? {
          ...asset,
          dayChangePercent:
            snapshot.dayChangePercent ?? asset.dayChangePercent,
          isStale:
            snapshot.lastPrice !== null || snapshot.dayChangePercent !== null
              ? false
              : asset.isStale,
          lastPrice: snapshot.lastPrice ?? asset.lastPrice,
        }
      : asset
  );
}

function normalizeInitialRange(value: string | null | undefined): ChartRange {
  const normalizedValue = value?.trim().toUpperCase() ?? "";

  return isChartRange(normalizedValue) ? normalizedValue : "1M";
}

function normalizeInitialSymbol(
  value: string | null | undefined,
  assets: WatchlistAsset[]
): string | null {
  const normalizedValue = value?.trim().toUpperCase() ?? "";

  return assets.some((asset) => asset.symbol === normalizedValue)
    ? normalizedValue
    : null;
}

export function DashboardClient({
  initialRange,
  initialSymbol,
  userProfile,
  watchlistAssets: initialWatchlistAssets,
}: DashboardClientProps) {
  const t = useTranslations("dashboard");
  const commonT = useTranslations("common");
  const userMenuRef = useRef<HTMLDetailsElement>(null);
  const { notifyAfterNavigation } = useNotifications();
  const { notify } = useNotifications();
  const [profile, setProfile] = useState(userProfile);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [watchlistAssets, setWatchlistAssets] = useState(initialWatchlistAssets);
  const watchlistAssetsRef = useRef(initialWatchlistAssets);
  const normalizedInitialSymbol = normalizeInitialSymbol(
    initialSymbol,
    initialWatchlistAssets
  );
  const [selectedSymbol, setSelectedSymbol] = useState(
    normalizedInitialSymbol ?? initialWatchlistAssets[0]?.symbol ?? null
  );
  const [chartRange, setChartRange] = useState<ChartRange>(
    normalizeInitialRange(initialRange)
  );
  const [isLoggingOut, startLogoutTransition] = useTransition();
  const [isDeletingProfile, startDeleteProfileTransition] = useTransition();
  const selectedAsset = useMemo(
    () =>
      watchlistAssets.find((asset) => asset.symbol === selectedSymbol) ??
      watchlistAssets[0] ??
      null,
    [selectedSymbol, watchlistAssets]
  );

  useEffect(() => {
    watchlistAssetsRef.current = watchlistAssets;
  }, [watchlistAssets]);

  function replaceDashboardUrl(symbol: string | null, range: ChartRange) {
    const params = new URLSearchParams(window.location.search);

    if (symbol) {
      params.set("symbol", symbol);
    } else {
      params.delete("symbol");
    }

    params.set("range", range);
    window.history.replaceState(null, "", `/dashboard?${params.toString()}`);
  }

  function handleSelectSymbol(symbol: string) {
    setSelectedSymbol(symbol);
    replaceDashboardUrl(symbol, chartRange);
  }

  function handleRangeChange(range: ChartRange) {
    const symbol = selectedAsset?.symbol ?? selectedSymbol;

    setChartRange(range);
    replaceDashboardUrl(symbol, range);
  }

  const loadWatchlistSnapshots = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/assets/watchlist", {
        cache: "no-store",
        signal,
      });

      if (!response.ok) {
        return;
      }

      const body = (await response.json()) as {
        assets?: WatchlistAsset[];
      };

      if (!signal?.aborted && body.assets) {
        watchlistAssetsRef.current = body.assets;
        setWatchlistAssets(body.assets);
      }
    } catch {
      // Keep the symbol list visible; the chart can still load independently.
    }
  }, []);

  const updateWatchlistSnapshot = useCallback(
    (snapshot: AssetSnapshotUpdate) => {
      const currentAssets = watchlistAssetsRef.current;
      const currentAsset = currentAssets.find(
        (asset) => asset.symbol === snapshot.symbol
      );
      const shouldReloadWatchlist = assetSnapshotChanged(
        currentAsset,
        snapshot
      );
      const nextAssets = mergeSnapshotIntoAssets(currentAssets, snapshot);

      watchlistAssetsRef.current = nextAssets;
      setWatchlistAssets(nextAssets);

      if (shouldReloadWatchlist) {
        void loadWatchlistSnapshots();
      }
    },
    [loadWatchlistSnapshots]
  );

  useEffect(() => {
    replaceDashboardUrl(selectedAsset?.symbol ?? selectedSymbol, chartRange);
  }, [chartRange, selectedAsset?.symbol, selectedSymbol]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadWatchlistSnapshots(controller.signal);
    }, 0);


    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadWatchlistSnapshots]);

  function addWatchlistAsset(asset: WatchlistAsset) {
    setWatchlistAssets((currentAssets) => {
      if (
        currentAssets.some((currentAsset) => currentAsset.symbol === asset.symbol)
      ) {
        return currentAssets;
      }

      const nextAssets = [...currentAssets, asset];

      watchlistAssetsRef.current = nextAssets;

      return nextAssets;
    });
  }

  async function updateWatchlistFavorite(
    symbol: string,
    isFavorite: boolean
  ) {
    let previousFavorite: boolean | null = null;

    setWatchlistAssets((currentAssets) =>
      currentAssets.map((asset) => {
        if (asset.symbol !== symbol) {
          return asset;
        }

        previousFavorite = asset.isFavorite;

        return {
          ...asset,
          isFavorite,
        };
      })
    );

    try {
      const response = await fetch("/api/assets/watchlist", {
        body: JSON.stringify({
          isFavorite,
          symbol,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("Favorite update failed");
      }

      const body = (await response.json()) as {
        isFavorite?: boolean;
        symbol?: string;
      };
      const savedSymbol = body.symbol ?? symbol;
      const savedFavorite = body.isFavorite ?? isFavorite;

      setWatchlistAssets((currentAssets) =>
        currentAssets.map((asset) =>
          asset.symbol === savedSymbol
            ? {
                ...asset,
                isFavorite: savedFavorite,
              }
            : asset
        )
      );
    } catch (error) {
      if (previousFavorite !== null) {
        const rollbackFavorite = previousFavorite;

        setWatchlistAssets((currentAssets) =>
          currentAssets.map((asset) =>
            asset.symbol === symbol
              ? {
                  ...asset,
                  isFavorite: rollbackFavorite,
                }
              : asset
          )
        );
      }

      throw error;
    }
  }

  function handleLogout() {
    startLogoutTransition(async () => {
      notifyAfterNavigation({
        title: "Logged out",
        tone: "success",
      });

      await signOut({
        callbackUrl: "/login",
        redirect: true,
      });
    });
  }

  function handleDeleteProfile() {
    const confirmed = window.confirm(t("confirmDeleteProfile"));

    if (!confirmed) {
      notify({
        title: "Account deletion cancelled",
        tone: "error",
      });
      return;
    }

    startDeleteProfileTransition(async () => {
      try {
        const response = await fetch("/api/account/delete", {
          method: "DELETE",
        });

        if (!response.ok) {
          window.alert(t("deleteProfileError"));
          notify({
            title: "Account deletion error",
            tone: "error",
          });
          return;
        }

        notifyAfterNavigation({
          title: "Account deleted",
          tone: "success",
        });
        await signOut({
          callbackUrl: "/login",
          redirect: true,
        });
      } catch {
        window.alert(t("deleteProfileError"));
      }
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
          onFavoriteChange={updateWatchlistFavorite}
          onSelectSymbol={handleSelectSymbol}
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
          onFavoriteChange={updateWatchlistFavorite}
          onSelectSymbol={handleSelectSymbol}
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
              {profile.role === "ADMIN" ? (
                <p className="app-eyebrow text-[var(--app-accent)]">ADMIN</p>
              ) : null}
              <p className="user-menu-email">{profile.email}</p>

              <button
                className="user-menu-action"
                onClick={handleOpenProfileDialog}
                type="button"
              >
                {t("profileSettings")}
              </button>

              <a className="user-menu-action" href="/settings/api">
                {t("apiSettings")}
              </a>

              <a className="user-menu-action" href="/api-docs">
                {t("apiDocs")}
              </a>

              <div className="user-menu-row">
                <span>{t("theme")}</span>
                <ThemeSwitch />
              </div>

              <div className="user-menu-row">
                <LanguageSelect className="language-select language-select-menu" />
              </div>

              <div className="user-menu-form">
                <button
                  className="user-menu-action delete-profile-button"
                  disabled={isDeletingProfile || isLoggingOut}
                  onClick={handleDeleteProfile}
                  type="button"
                >
                  {isDeletingProfile ? t("deletingProfile") : t("deleteProfile")}
                </button>

                <button
                  className="user-menu-action logout-button"
                  disabled={isLoggingOut || isDeletingProfile}
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
          <AssetChart
            asset={selectedAsset}
            onAssetSnapshotChange={updateWatchlistSnapshot}
            onRangeChange={handleRangeChange}
            range={chartRange}
          />

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
