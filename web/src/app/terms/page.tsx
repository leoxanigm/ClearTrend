import { AppLogo } from "@/components/AppLogo";
import { FooterLinks } from "@/components/FooterLinks";
import { authOptions } from "@/lib/auth-options";
import { getTranslations } from "next-intl/server";
import { getServerSession } from "next-auth";

const termsSections = [
  "scope",
  "account",
  "financialDisclaimer",
  "dataSources",
  "acceptableUse",
  "availability",
  "exports",
  "changes",
] as const;

export default async function TermsPage() {
  const t = await getTranslations("legal");
  const commonT = await getTranslations("common");
  const session = await getServerSession(authOptions);
  const homeHref = session ? "/dashboard" : "/login";
  const homeLabel = session ? commonT("dashboard") : commonT("login");

  return (
    <main className="legal-page">
      <AppLogo
        href={homeHref}
        linkClassName="app-link text-sm font-medium"
        size="small"
      />

      <article className="mt-16 space-y-8">
        <div className="space-y-3">
          <p className="app-eyebrow uppercase tracking-wide">
            {commonT("legal")}
          </p>
          <h1 className="text-4xl font-semibold">{t("terms.title")}</h1>
          <p className="legal-copy text-sm">{t("terms.updated")}</p>
          <p className="legal-copy">{t("terms.intro")}</p>
        </div>

        {termsSections.map((section) => (
          <section className="space-y-2" key={section}>
            <h2 className="text-2xl font-semibold">
              {t(`terms.sections.${section}.title`)}
            </h2>
            <p className="legal-copy">
              {t(`terms.sections.${section}.body`)}
            </p>
          </section>
        ))}
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
