import { AppLogo } from "@/components/AppLogo";
import { FooterLinks } from "@/components/FooterLinks";
import { Button } from "@/components/ui/Button";
import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const watchlist = ["AAPL", "MSFT", "NVDA"];

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

        <nav className="mt-10 space-y-2">
          {watchlist.map((symbol) => (
            <Button key={symbol} variant="sidebar">
              {symbol}
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

        <nav className="mt-10 space-y-2">
          {watchlist.map((symbol) => (
            <label
              className="sidebar-item"
              htmlFor="dashboard-drawer"
              key={symbol}
            >
              {symbol}
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
              <p className="app-eyebrow">{session.email}</p>
              <form action="/api/auth/logout" method="post">
                <Button type="submit" variant="outline">
                  Logout
                </Button>
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
