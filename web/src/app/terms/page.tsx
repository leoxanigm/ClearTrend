import { AppLogo } from "@/components/AppLogo";
import { FooterLinks } from "@/components/FooterLinks";
import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

export default async function TermsPage() {
  const t = await getTranslations("legal");
  const commonT = await getTranslations("common");
  const cookieStore = await cookies();
  const session = verifySessionToken(
    cookieStore.get(sessionCookieName)?.value
  );
  const homeHref = session ? "/dashboard" : "/login";
  const homeLabel = session ? commonT("dashboard") : commonT("login");

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
            {commonT("legal")}
          </p>
          <h1 className="text-4xl font-semibold">{t("terms.title")}</h1>
        </div>

        <p className="legal-copy">{t("terms.p1")}</p>

        <p className="legal-copy">{t("terms.p2")}</p>

        <p className="legal-copy">{t("terms.p3")}</p>
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
            label: commonT("privacy"),
          },
        ]}
      />
    </main>
  );
}
