import { AppLogo } from "@/components/AppLogo";
import { FooterLinks } from "@/components/FooterLinks";
import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { cookies } from "next/headers";

export default async function TermsPage() {
  const cookieStore = await cookies();
  const session = verifySessionToken(
    cookieStore.get(sessionCookieName)?.value
  );
  const homeHref = session ? "/dashboard" : "/login";
  const homeLabel = session ? "Dashboard" : "Login";

  return (
    <main className="legal-page">
      <AppLogo
        href={homeHref}
        linkClassName="app-link text-sm font-medium"
        size="small"
      />

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

      <FooterLinks
        className="mt-auto flex gap-4 pt-12 text-sm"
        items={[
          {
            href: homeHref,
            label: homeLabel,
          },
          {
            href: "/privacy",
            label: "Privacy Policy",
          },
        ]}
      />
    </main>
  );
}
