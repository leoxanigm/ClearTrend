import Link from "next/link";
import Image from "next/image";

const watchlist = ["AAPL", "MSFT", "NVDA"];

export default function DashboardPage() {
  return (
    <main className="app-shell">
      <aside className="app-sidebar">
        <Link className="text-xl font-semibold" href="/dashboard">
          <picture>
            <source
              media="(prefers-color-scheme: light)"
              srcSet="/logo-draft67.png"
            />
            <Image
              alt="ClearTrend logo"
              className="brand-logo-small"
              height={90}
              priority
              src="/logo-draft10.png"
              width={120}
            />
          </picture>
        </Link>

        <nav className="mt-10 space-y-2">
          {watchlist.map((symbol) => (
            <button className="sidebar-item" key={symbol}>
              {symbol}
            </button>
          ))}
        </nav>

        <footer className="mt-auto flex gap-3 text-xs">
          <Link className="app-link" href="/privacy">
            Privacy
          </Link>
          <Link className="app-link" href="/terms">
            Terms
          </Link>
        </footer>
      </aside>

      <section className="app-content">
        <header className="flex items-center justify-between">
          <div>
            <p className="app-eyebrow">Dashboard</p>
            <h1 className="text-3xl font-semibold">Market overview</h1>
          </div>

          <button className="outline-button">User menu</button>
        </header>

        <div className="mt-8 grid flex-1 gap-6 lg:grid-cols-[1fr_280px]">
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
