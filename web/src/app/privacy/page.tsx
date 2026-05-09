import { AppLogo } from "@/components/AppLogo";
import { FooterLinks } from "@/components/FooterLinks";
import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { cookies } from "next/headers";

export default async function PrivacyPage() {
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

      <FooterLinks
        className="mt-auto flex gap-4 pt-12 text-sm"
        items={[
          {
            href: homeHref,
            label: homeLabel,
          },
          {
            href: "/terms",
            label: "Terms of Service",
          },
        ]}
      />
    </main>
  );
}
