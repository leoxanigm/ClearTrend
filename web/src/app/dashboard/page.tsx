import { AppLogo } from "@/components/AppLogo";
import { FooterLinks } from "@/components/FooterLinks";
import { Button } from "@/components/ui/Button";
import { ThemeSwitch } from "@/components/ui/ThemeSwitch";
import { getWatchlistAssets } from "@/lib/assets";
import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

function formatDayChangePercent(value: number | null) {
  if (value === null) {
    return "N/A";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getDayChangeClass(value: number | null) {
  if (value === null || value === 0) {
    return "asset-performance-muted";
  }

  return value > 0
    ? "asset-performance-positive"
    : "asset-performance-negative";
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const session = verifySessionToken(
    cookieStore.get(sessionCookieName)?.value
  );

  if (!session) {
    redirect("/login");
  }

  const userName = session.email.split("@")[0] || session.email;
  const userInitial = session.email.slice(0, 1).toUpperCase();
  const watchlistAssets = await getWatchlistAssets();

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

        <nav className="watchlist-nav mt-10 space-y-2">
          {watchlistAssets.map((asset) => (
            <Button
              aria-label={`${asset.name} ${formatDayChangePercent(
                asset.dayChangePercent
              )}`}
              className="sidebar-asset"
              key={asset.symbol}
              variant="sidebar"
            >
              <span className="sidebar-asset-main">
                <span className="sidebar-asset-name">{asset.name}</span>
                <span className="sidebar-asset-symbol">{asset.symbol}</span>
              </span>
              <span
                className={`sidebar-performance ${getDayChangeClass(
                  asset.dayChangePercent
                )}`}
              >
                {formatDayChangePercent(asset.dayChangePercent)}
              </span>
            </Button>
          ))}
        </nav>

        <FooterLinks
          className="mt-auto flex gap-3 text-xs"
          items={[
            {
              href: "/privacy",
              label: "Privacy",
            },
            {
              href: "/terms",
              label: "Terms",
            },
          ]}
        />
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

        <nav className="watchlist-nav mt-10 space-y-2">
          {watchlistAssets.map((asset) => (
            <label
              className="sidebar-item sidebar-asset"
              htmlFor="dashboard-drawer"
              key={asset.symbol}
            >
              <span className="sidebar-asset-main">
                <span className="sidebar-asset-name">{asset.name}</span>
                <span className="sidebar-asset-symbol">{asset.symbol}</span>
              </span>
              <span
                className={`sidebar-performance ${getDayChangeClass(
                  asset.dayChangePercent
                )}`}
              >
                {formatDayChangePercent(asset.dayChangePercent)}
              </span>
            </label>
          ))}
        </nav>

        <FooterLinks
          className="mt-auto flex gap-3 text-xs"
          items={[
            {
              href: "/privacy",
              label: "Privacy",
            },
            {
              href: "/terms",
              label: "Terms",
            },
          ]}
        />
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
              <p className="user-menu-email">{session.email}</p>

              <div className="user-menu-row">
                <span>Theme</span>
                <ThemeSwitch />
              </div>

              <form action="/api/auth/logout" className="user-menu-form" method="post">
                <button className="user-menu-action" type="submit">
                  Logout
                </button>
              </form>
            </div>
          </details>
        </header>

        <div className="dashboard-grid mt-8 grid flex-1 gap-6 lg:grid-cols-[1fr_280px]">
          <section className="app-card p-6">
            <div className="chart-placeholder">Chart area</div>
          </section>

          <aside className="space-y-4">
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
