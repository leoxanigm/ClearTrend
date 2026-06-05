import { AppLogo } from "@/components/AppLogo";
import { getCurrentUserProfile } from "@/lib/profile";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

export default async function AdminPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "ADMIN") {
    notFound();
  }

  const t = await getTranslations("adminPage");
  const dashboardT = await getTranslations("dashboard");
  const commonT = await getTranslations("common");

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <AppLogo
          ariaLabel={dashboardT("logoAria")}
          href="/dashboard"
          size="small"
        />

        <a className="secondary-link-button" href="/dashboard">
          {commonT("dashboard")}
        </a>
      </header>

      <section className="admin-page-content">
        <div>
          <p className="app-eyebrow">{t("eyebrow")}</p>
          <h1>{t("title")}</h1>
          <p className="admin-page-description">{t("description")}</p>
        </div>

        <div className="admin-panel">
          <dl className="admin-metadata">
            <div>
              <dt>{t("fields.account")}</dt>
              <dd>{profile.displayName}</dd>
            </div>
            <div>
              <dt>{t("fields.email")}</dt>
              <dd>{profile.email}</dd>
            </div>
            <div>
              <dt>{t("fields.role")}</dt>
              <dd>{profile.role}</dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}
