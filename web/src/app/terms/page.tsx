import Link from "next/link";
import Image from "next/image";

export default function TermsPage() {
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
          <h1 className="text-4xl font-semibold">Terms of Service</h1>
        </div>

        <p className="legal-copy">
          ClearTrend provides tools for exploring market data, watchlists, and
          automated analysis in an educational context.
        </p>

        <p className="legal-copy">
          The information shown by the application is not investment advice.
          Users remain responsible for any decision made from external market
          information or generated content.
        </p>

        <p className="legal-copy">
          Access to the service can change during development as authentication,
          permissions, and data sources are added.
        </p>
      </article>

      <footer className="mt-auto flex gap-4 pt-12 text-sm">
        <Link className="app-link" href="/login">
          Login
        </Link>
        <Link className="app-link" href="/privacy">
          Privacy Policy
        </Link>
      </footer>
    </main>
  );
}
