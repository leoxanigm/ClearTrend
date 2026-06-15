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
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { MetricTile } from "@/components/ui/MetricTile";
import { useNotifications } from "@/components/ui/Notifications";
import { Tooltip } from "@/components/ui/Tooltip";
import { UserAvatar } from "@/components/UserAvatar";
import { WatchlistNav } from "@/components/WatchlistNav";
import { LanguageSelect } from "@/components/ui/LanguageSelect";
import { ThemeSwitch } from "@/components/ui/ThemeSwitch";
import type { WatchlistAsset } from "@/lib/assets";
import { isChartRange, type ChartRange } from "@/lib/analysis-data";
import {
  chartRangeToMlHorizon,
  supportsMlAnalysis,
  type MlAnalysis,
  type MlPrediction,
} from "@/lib/ml-analysis";
import type { UserProfile } from "@/lib/profile-types";
import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";

// Dashboard inputs and local data contracts
type DashboardClientProps = {
  financeRefreshRateSeconds: number;
  initialRange?: string | null;
  initialSymbol?: string | null;
  userProfile: UserProfile;
  watchlistAssets: WatchlistAsset[];
};

type AssetSnapshotUpdate = {
  // The chart publishes only fields that can refresh an existing watchlist row.
  dayChangePercent: number | null;
  lastPrice: number | null;
  symbol: string;
};

type MlAnalysisState =
  // A discriminated union prevents reading ML data before it is ready.
  | { status: "idle" | "loading" | "unavailable"; value: null }
  | { status: "ready"; value: MlAnalysis };

type MetricTone = "accent" | "negative" | "positive" | "secondary";

const marketValueTolerance = 0.000001;

// Map normalized ML scores to the visual tone used by metric tiles.
function scoreTone(score: number | null, fallback: MetricTone): MetricTone {
  if (score === null) {
    return fallback;
  }

  if (score >= 0.57) {
    return "positive";
  }

  if (score <= 0.43) {
    return "negative";
  }

  return fallback;
}

function percentScore(value: number) {
  // ML scores are normalized from 0 to 1 and displayed as percentages.
  return `${Math.round(value * 100)}%`;
}

function signedPercentScore(value: number) {
  const roundedValue = Math.round(value * 100);

  return `${roundedValue > 0 ? "+" : ""}${roundedValue}%`;
}

function assetSnapshotChanged(
  asset: WatchlistAsset | undefined,
  snapshot: AssetSnapshotUpdate
) {
  // Stale rows should accept chart data directly instead of causing a reload loop.
  if (!asset || asset.isStale) {
    return false;
  }

  const changed = (currentValue: number | null, nextValue: number | null) =>
    // Ignore missing values and insignificant floating-point differences.
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
  // Preserve array order and replace only the matching immutable asset object.
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

// Sanitize URL-provided state before using it as initial dashboard state.
function normalizeInitialRange(value: string | null | undefined): ChartRange {
  const normalizedValue = value?.trim().toUpperCase() ?? "";

  return isChartRange(normalizedValue) ? normalizedValue : "1M";
}

function normalizeInitialSymbol(
  value: string | null | undefined,
  assets: WatchlistAsset[]
): string | null {
  // URL symbols are accepted only when already available in the user's watchlist.
  const normalizedValue = value?.trim().toUpperCase() ?? "";

  return assets.some((asset) => asset.symbol === normalizedValue)
    ? normalizedValue
    : null;
}

export function DashboardClient({
  financeRefreshRateSeconds,
  initialRange,
  initialSymbol,
  userProfile,
  watchlistAssets: initialWatchlistAssets,
}: DashboardClientProps) {
  // User, watchlist, selection, and asynchronous operation state
  const t = useTranslations("dashboard");
  const commonT = useTranslations("common");
  const userMenuRef = useRef<HTMLDetailsElement>(null);
  const { notifyAfterNavigation } = useNotifications();
  const { notify } = useNotifications();
  const [profile, setProfile] = useState(userProfile);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [watchlistAssets, setWatchlistAssets] = useState(initialWatchlistAssets);
  const [loadedWatchlistPerformanceRange, setLoadedWatchlistPerformanceRange] =
    useState<ChartRange>("1D");
  const [watchlistPerformanceBySymbol, setWatchlistPerformanceBySymbol] =
    useState<Record<string, number | null>>({});
  const [watchlistPerformanceRefreshKey, setWatchlistPerformanceRefreshKey] =
    useState(0);
  const [watchlistPerformanceRange, setWatchlistPerformanceRange] =
    useState<ChartRange>("1D");
  // The ref gives async callbacks the newest list without unstable dependencies.
  const watchlistAssetsRef = useRef(initialWatchlistAssets);
  const normalizedInitialSymbol = normalizeInitialSymbol(
    initialSymbol,
    initialWatchlistAssets
  );
  const [selectedSymbol, setSelectedSymbol] = useState(
    normalizedInitialSymbol ?? initialWatchlistAssets[0]?.symbol ?? null
  );
  const [mlAnalysis, setMlAnalysis] = useState<MlAnalysisState>({
    status: "idle",
    value: null,
  });
  const [chartRange, setChartRange] = useState<ChartRange>(
    normalizeInitialRange(initialRange)
  );
  // Transitions keep account actions responsive while navigation is pending.
  const [isLoggingOut, startLogoutTransition] = useTransition();
  const [isDeletingProfile, startDeleteProfileTransition] = useTransition();

  // Selected asset and ML presentation derived from the current range
  const selectedAsset = useMemo(
    () =>
      watchlistAssets.find((asset) => asset.symbol === selectedSymbol) ??
      watchlistAssets[0] ??
      null,
    [selectedSymbol, watchlistAssets]
  );
  const selectedAssetHasMlAnalysis = supportsMlAnalysis(
    selectedAsset?.symbol
  );
  // The chart range is converted into the nearest supported ML horizon.
  const mlHorizon = chartRangeToMlHorizon(chartRange);
  const mlPrediction: MlPrediction | null =
    mlAnalysis.status === "ready"
      ? mlAnalysis.value.predictions.find(
          (prediction) => prediction.horizon === mlHorizon
        ) ?? null
      : null;
  const mlSentiment =
    mlAnalysis.status === "ready"
      ? mlAnalysis.value.social.sentiment
      : null;
  const mlAttention =
    mlAnalysis.status === "ready"
      ? mlAnalysis.value.social.attention
      : null;
  const mlTrendValue =
    mlAnalysis.status === "loading"
      ? t("mlLoading")
      : mlPrediction
        ? `${t(`mlTrend${mlPrediction.trend}`)} ${percentScore(
            mlPrediction.score
          )}`
        : t("mlUnavailable");
  const mlTrendDescription = mlPrediction
    ? t("mlTrendDescription", {
        confidence: percentScore(mlPrediction.confidence),
        horizon: mlPrediction.horizon,
        price: mlPrediction.estimatedPrice.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        }),
      })
    : undefined;
  const sentimentScore =
    mlSentiment?.available && typeof mlSentiment.score === "number"
      ? mlSentiment.score
      : null;
  const sentimentTrend =
    // Scores around 0.5 are deliberately treated as neutral.
    sentimentScore === null
      ? null
      : sentimentScore >= 0.57
        ? "bullish"
        : sentimentScore <= 0.43
        ? "bearish"
        : "neutral";
  const mlSentimentValue =
    mlAnalysis.status === "loading"
      ? t("mlLoading")
      : sentimentScore !== null && sentimentTrend
        ? (
            <Tooltip
              content={t("mlSentimentScoreHelp")}
              label={t("mlSentimentScoreLabel")}
            >
              {t(`mlSentiment${sentimentTrend}`, {
                score: Math.round(sentimentScore * 100),
              })}
            </Tooltip>
          )
        : mlAnalysis.status === "ready"
          ? "—"
          : t("mlUnavailable");
  const mlSentimentDescription =
    sentimentScore !== null && mlSentiment
      ? (
          <div className="ui-metric-detail-row">
            <Tooltip
              content={t("mlMessagesHelp")}
              label={t("mlMessagesLabel")}
            >
              {t("mlMessagesValue", { count: mlSentiment.postCount })}
            </Tooltip>
            <Tooltip
              content={t("mlAgreementHelp")}
              label={t("mlAgreementLabel")}
            >
              {t("mlAgreementValue", {
                agreement: percentScore(mlSentiment.agreement ?? 0),
              })}
            </Tooltip>
            {mlAttention?.available &&
            typeof mlAttention.mentions === "number" ? (
              <Tooltip
                content={t("mlMentionsHelp")}
                label={t("mlMentionsLabel")}
              >
                {t("mlMentionsValue", {
                  count: mlAttention.mentions,
                  growth:
                    typeof mlAttention.mentionGrowth === "number"
                      ? signedPercentScore(mlAttention.mentionGrowth)
                      : "—",
                })}
              </Tooltip>
            ) : null}
          </div>
        )
      : mlAnalysis.status === "ready" && mlSentiment
        // A ready analysis may still lack enough social data for a score.
        ? t("mlSentimentUnavailableReason")
        : undefined;
  const watchlistSymbols = useMemo(
    () => watchlistAssets.map((asset) => asset.symbol).join(","),
    [watchlistAssets]
  );
  const visibleWatchlistPerformanceBySymbol =
    // Hide old-range values while the newly selected range is loading.
    loadedWatchlistPerformanceRange === watchlistPerformanceRange
      ? watchlistPerformanceBySymbol
      : {};
  const isWatchlistPerformanceLoading =
    watchlistPerformanceRange !== "1D" &&
    loadedWatchlistPerformanceRange !== watchlistPerformanceRange;

  // Keep callback reads synchronized with the latest React watchlist state.
  useEffect(() => {
    watchlistAssetsRef.current = watchlistAssets;
  }, [watchlistAssets]);

  // URL synchronization keeps the selected asset and range shareable.
  function replaceDashboardUrl(symbol: string | null, range: ChartRange) {
    // replaceState avoids adding one browser-history entry per chart interaction.
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

  const signOutUnauthorizedSession = useCallback(() => {
    // A banned or expired session is handled consistently by every dashboard request.
    notifyAfterNavigation({
      title: "Session ended",
      tone: "error",
    });

    void signOut({
      callbackUrl: "/login?error=BANNED",
      redirect: true,
    });
  }, [notifyAfterNavigation]);

  // Reload canonical watchlist snapshots from the backend.
  const loadWatchlistSnapshots = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/assets/watchlist", {
        cache: "no-store",
        signal,
      });

      if (response.status === 401 || response.status === 403) {
        signOutUnauthorizedSession();
        return;
      }

      if (!response.ok) {
        return;
      }

      const body = (await response.json()) as {
        assets?: WatchlistAsset[];
      };

      if (!signal?.aborted && body.assets) {
        // Update the ref before state so concurrent callbacks see the same snapshot.
        watchlistAssetsRef.current = body.assets;
        setWatchlistAssets(body.assets);
      }
    } catch {
      // Keep the symbol list visible; the chart can still load independently.
    }
  }, [signOutUnauthorizedSession]);

  // Merge fast chart updates locally, then refresh when server values diverge.
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

      // Apply immediate selected-row values before any optional full refresh.
      watchlistAssetsRef.current = nextAssets;
      setWatchlistAssets(nextAssets);

      if (shouldReloadWatchlist) {
        // A meaningful selected-asset change can invalidate other cached row values.
        void loadWatchlistSnapshots();

        if (watchlistPerformanceRange !== "1D") {
          setWatchlistPerformanceRefreshKey((currentKey) => currentKey + 1);
        }
      }
    },
    [loadWatchlistSnapshots, watchlistPerformanceRange]
  );

  useEffect(() => {
    // This effect also repairs invalid initial symbols by writing the fallback.
    replaceDashboardUrl(selectedAsset?.symbol ?? selectedSymbol, chartRange);
  }, [chartRange, selectedAsset?.symbol, selectedSymbol]);

  // Load the cached ML analysis only for supported assets and active horizon.
  useEffect(() => {
    const symbol = selectedAsset?.symbol;
    const controller = new AbortController();
    let retryTimeoutId: number | undefined;

    const attemptFetch = () => {
      void fetch(
        `/api/ml/analyse?symbol=${encodeURIComponent(
          symbol!
        )}&horizon=${mlHorizon}`,
        { signal: controller.signal }
      )
        .then(async (response) => {
          if (!response.ok) {
            if (response.status === 503) {
              retryTimeoutId = window.setTimeout(attemptFetch, 15_000);
              return;
            }
            setMlAnalysis({ status: "unavailable", value: null });
            return;
          }

          const body = (await response.json()) as MlAnalysis;
          // The API returns cached backend analysis, not a browser-side calculation.
          setMlAnalysis({ status: "ready", value: body });
        })
        .catch((error: unknown) => {
          if (
            error instanceof DOMException &&
            error.name === "AbortError"
          ) {
            return;
          }

          setMlAnalysis({ status: "unavailable", value: null });
        });
    };

    // Deferring the request avoids synchronous state changes during effect setup.
    const timeoutId = window.setTimeout(() => {
      if (!symbol || !supportsMlAnalysis(symbol)) {
        setMlAnalysis({ status: "idle", value: null });
        return;
      }

      setMlAnalysis({ status: "loading", value: null });
      attemptFetch();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearTimeout(retryTimeoutId);
      controller.abort();
    };
  }, [mlHorizon, selectedAsset?.symbol]);

  // Refresh the complete watchlist once after mounting.
  useEffect(() => {
    const controller = new AbortController();
    // Schedule after mount so the server-rendered interface appears immediately.
    const timeoutId = window.setTimeout(() => {
      void loadWatchlistSnapshots(controller.signal);
    }, 0);


    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadWatchlistSnapshots]);

  // Non-daily watchlist performance is fetched separately for all symbols.
  useEffect(() => {
    if (watchlistPerformanceRange === "1D" || !watchlistSymbols) {
      return;
    }

    const controller = new AbortController();

    async function loadWatchlistPerformance() {
      try {
        const response = await fetch(
          `/api/assets/performance?range=${watchlistPerformanceRange}&symbols=${encodeURIComponent(
            watchlistSymbols
          )}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error("Watchlist performance request failed");
        }

        const body = (await response.json()) as {
          performances?: Array<{
            performancePercent: number | null;
            symbol: string;
          }>;
        };
        const nextPerformanceBySymbol = Object.fromEntries(
          // Normalize the API array into constant-time lookup by symbol.
          (body.performances ?? []).map((performance) => [
            performance.symbol,
            performance.performancePercent,
          ])
        );

        if (!controller.signal.aborted) {
          setLoadedWatchlistPerformanceRange(watchlistPerformanceRange);
          setWatchlistPerformanceBySymbol(nextPerformanceBySymbol);
        }
      } catch {
        if (!controller.signal.aborted) {
          setLoadedWatchlistPerformanceRange(watchlistPerformanceRange);
          setWatchlistPerformanceBySymbol({});
        }
      }
    }

    void loadWatchlistPerformance();

    return () => controller.abort();
  }, [
    watchlistPerformanceRange,
    watchlistPerformanceRefreshKey,
    watchlistSymbols,
  ]);

  // Watchlist mutation actions
  function addWatchlistAsset(asset: WatchlistAsset) {
    setWatchlistAssets((currentAssets) => {
      // Search can return an asset already added by another concurrent action.
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
    // Update immediately for responsiveness and retain the old value for rollback.
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

      if (response.status === 401 || response.status === 403) {
        signOutUnauthorizedSession();
        return;
      }

      if (!response.ok) {
        throw new Error("Favorite update failed");
      }

      const body = (await response.json()) as {
        isFavorite?: boolean;
        symbol?: string;
      };
      const savedSymbol = body.symbol ?? symbol;
      const savedFavorite = body.isFavorite ?? isFavorite;

      // Reconcile the optimistic value with the canonical server response.
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
        // Restore the exact previous value when persistence fails.
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

  // Account and profile actions
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
    // Account deletion remains behind an explicit destructive confirmation.
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
    // Close the native details menu before mounting the modal over the page.
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

  // Desktop/mobile navigation, chart, AI metrics, and profile modal
  return (
    <main className="app-shell">
      {/* A hidden checkbox controls the CSS-only mobile watchlist drawer. */}
      <input
        className="mobile-drawer-toggle"
        id="dashboard-drawer"
        type="checkbox"
      />

      <aside className="app-sidebar app-sidebar-desktop">
        {/* Desktop and mobile navigations share the same data and callbacks. */}
        <AppLogo
          ariaLabel={t("logoAria")}
          href="/dashboard"
          size="small"
        />

        <WatchlistNav
          assets={watchlistAssets}
          onAssetAdd={addWatchlistAsset}
          onFavoriteChange={updateWatchlistFavorite}
          onPerformanceRangeChange={setWatchlistPerformanceRange}
          onSelectSymbol={handleSelectSymbol}
          performanceBySymbol={visibleWatchlistPerformanceBySymbol}
          performanceLoading={isWatchlistPerformanceLoading}
          performanceRange={watchlistPerformanceRange}
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
          onPerformanceRangeChange={setWatchlistPerformanceRange}
          onSelectSymbol={handleSelectSymbol}
          performanceBySymbol={visibleWatchlistPerformanceBySymbol}
          performanceLoading={isWatchlistPerformanceLoading}
          performanceRange={watchlistPerformanceRange}
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

          <DropdownMenu
            className="user-menu"
            label={t("openUserMenu", {
                name: profile.displayName,
            })}
            panelClassName="user-menu-panel"
            ref={userMenuRef}
            trigger={<UserAvatar className="user-menu-avatar" profile={profile} />}
            triggerClassName="user-menu-trigger"
          >
              <p className="user-menu-name">{profile.displayName}</p>
              {profile.role === "ADMIN" ? (
                <Badge tone="accent">ADMIN</Badge>
              ) : null}
              <p className="user-menu-email">{profile.email}</p>

              <Button
                className="user-menu-action"
                onClick={handleOpenProfileDialog}
                variant="plain"
              >
                {t("profileSettings")}
              </Button>

              {profile.role === "ADMIN" ? (
                <a className="user-menu-action" href="/admin">
                  {t("adminPage")}
                </a>
              ) : null}

              {profile.role === "ADMIN" || profile.role === "ANALYST" ? (
                <a className="user-menu-action" href="/analyst">
                  {t("analystPage")}
                </a>
              ) : null}

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
                <Button
                  className="user-menu-action delete-profile-button"
                  disabled={isDeletingProfile || isLoggingOut}
                  onClick={handleDeleteProfile}
                  variant="plain"
                >
                  {isDeletingProfile ? t("deletingProfile") : t("deleteProfile")}
                </Button>

                <Button
                  className="user-menu-action logout-button"
                  disabled={isLoggingOut || isDeletingProfile}
                  onClick={handleLogout}
                  variant="plain"
                >
                  {isLoggingOut ? t("loggingOut") : t("logout")}
                </Button>
              </div>
          </DropdownMenu>
        </header>

        <div className="dashboard-grid mt-8 grid flex-1 gap-6">
          {/* The chart publishes fresh snapshot values back to this parent. */}
          <AssetChart
            asset={selectedAsset}
            financeRefreshRateSeconds={financeRefreshRateSeconds}
            key={selectedAsset?.symbol ?? "no-asset"}
            onAssetSnapshotChange={updateWatchlistSnapshot}
            onRangeChange={handleRangeChange}
            range={chartRange}
          />

          {selectedAssetHasMlAnalysis ? (
            // Hide the complete AI group for assets outside the supported universe.
            <fieldset className="dashboard-ai-analysis">
              <legend className="dashboard-ai-analysis-legend">
                {t("aiAnalysis")}
              </legend>

              <div className="dashboard-summary-grid">
                <MetricTile
                  description={mlTrendDescription}
                  label={t("trend")}
                  tone={scoreTone(mlPrediction?.score ?? null, "accent")}
                  value={mlTrendValue}
                />

                <MetricTile
                  description={mlSentimentDescription}
                  label={t("sentiment")}
                  tone={scoreTone(sentimentScore, "secondary")}
                  value={mlSentimentValue}
                />
              </div>
            </fieldset>
          ) : null}
        </div>
      </section>

      {isProfileDialogOpen ? (
        <ProfileSettingsDialog
          onClose={() => setIsProfileDialogOpen(false)}
          onProfileSave={setProfile}
          onWatchlistImport={() => void loadWatchlistSnapshots()}
          profile={profile}
        />
      ) : null}
    </main>
  );
}
