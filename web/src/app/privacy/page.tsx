import { AppLogo } from "@/components/AppLogo";
import { FooterLinks } from "@/components/FooterLinks";
import { authOptions } from "@/lib/auth-options";
import { getTranslations } from "next-intl/server";
import { getServerSession } from "next-auth";

export default async function PrivacyPage() {
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

      <article className="mt-16 space-y-6">
        <div className="space-y-3">
          <p className="app-eyebrow uppercase tracking-wide">
            {commonT("legal")}
          </p>
          <h1 className="text-4xl font-semibold">{t("privacy.title")}</h1>
        </div>

        <p className="legal-copy">{t("privacy.p1")}</p>

        <p className="legal-copy">{t("privacy.p2")}</p>

        <p className="legal-copy">{t("privacy.p3")}</p>
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
            label: commonT("terms"),
          },
        ]}
      />
    </main>
  );
}
