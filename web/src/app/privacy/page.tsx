import Link from "next/link";
import Image from "next/image";

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <Link className="app-link text-sm font-medium" href="/login">
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

      <article className="mt-16 space-y-6">
        <div className="space-y-3">
          <p className="app-eyebrow uppercase tracking-wide">
            Legal
          </p>
          <h1 className="text-4xl font-semibold">Privacy Policy</h1>
        </div>

        <p className="legal-copy">
          ClearTrend is an educational project. The application may store
          account information, watchlist entries, preferences, and technical
          logs needed to run and secure the service.
        </p>

        <p className="legal-copy">
          Financial data, sentiment results, and generated analysis are used to
          display trends inside the product. They should not be treated as
          professional financial advice.
        </p>

        <p className="legal-copy">
          Users can request profile updates or account deletion when account
          management is implemented.
        </p>
      </article>

      <footer className="mt-auto flex gap-4 pt-12 text-sm">
        <Link className="app-link" href="/login">
          Login
        </Link>
        <Link className="app-link" href="/terms">
          Terms of Service
        </Link>
      </footer>
    </main>
  );
}
