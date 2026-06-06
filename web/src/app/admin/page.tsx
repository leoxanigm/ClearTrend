import { AppLogo } from "@/components/AppLogo";
import { FooterLinks } from "@/components/FooterLinks";
import { LanguageSelect } from "@/components/ui/LanguageSelect";
import { getPrisma } from "@/lib/prisma";
import { getCurrentUserProfile } from "@/lib/profile";
import { getLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

async function toggleUserBan(formData: FormData) {
  "use server";

  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "ADMIN") {
    notFound();
  }

  const userId = formData.get("userId");
  const banAction = formData.get("banAction");

  if (typeof userId !== "string" || userId.length === 0) {
    return;
  }

  if (userId === profile.id) {
    return;
  }

  const prisma = getPrisma();

  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      bannedAt: banAction === "ban" ? new Date() : null,
    },
  });

  revalidatePath("/admin");
}

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
  const locale = await getLocale();
  const prisma = getPrisma();
  const users = await prisma.user.findMany({
    where: {
      NOT: {
        oauthProvider: "credentials",
        passwordHash: null,
      },
    },
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      email: true,
      displayName: true,
      favoriteSymbols: true,
      role: true,
      bannedAt: true,
      oauthProvider: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          analyses: true,
          apiKeys: true,
          reports: true,
        },
      },
    },
  });
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

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
          <div className="admin-panel-heading">
            <div>
              <h2>{t("users.title")}</h2>
              <p>{t("users.description")}</p>
            </div>
            <strong>
              {t("users.total", {
                count: users.length,
              })}
            </strong>
          </div>

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

          <div className="admin-users-table-wrap">
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th scope="col">{t("users.columns.user")}</th>
                  <th scope="col">{t("users.columns.role")}</th>
                  <th scope="col">{t("users.columns.status")}</th>
                  <th scope="col">{t("users.columns.provider")}</th>
                  <th scope="col">{t("users.columns.watchlists")}</th>
                  <th scope="col">{t("users.columns.analyses")}</th>
                  <th scope="col">{t("users.columns.reports")}</th>
                  <th scope="col">{t("users.columns.apiKeys")}</th>
                  <th scope="col">{t("users.columns.created")}</th>
                  <th scope="col">{t("users.columns.updated")}</th>
                  <th scope="col">{t("users.columns.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="admin-user-identity">
                        <strong>
                          {user.displayName?.trim() || t("users.unnamed")}
                        </strong>
                        <span>{user.email}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`admin-role-badge admin-role-badge-${user.role.toLowerCase()}`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`admin-status-badge ${
                          user.bannedAt
                            ? "admin-status-badge-banned"
                            : "admin-status-badge-active"
                        }`}
                      >
                        {user.bannedAt
                          ? t("users.status.banned")
                          : t("users.status.active")}
                      </span>
                    </td>
                    <td>{user.oauthProvider || t("users.passwordProvider")}</td>
                    <td>{user.favoriteSymbols.length}</td>
                    <td>{user._count.analyses}</td>
                    <td>{user._count.reports}</td>
                    <td>{user._count.apiKeys}</td>
                    <td>{dateFormatter.format(user.createdAt)}</td>
                    <td>{dateFormatter.format(user.updatedAt)}</td>
                    <td>
                      <form action={toggleUserBan}>
                        <input name="userId" type="hidden" value={user.id} />
                        <input
                          name="banAction"
                          type="hidden"
                          value={user.bannedAt ? "unban" : "ban"}
                        />
                        <button
                          className={
                            user.bannedAt
                              ? "admin-user-action-button"
                              : "admin-user-action-button admin-user-action-button-danger"
                          }
                          disabled={user.id === profile.id}
                          type="submit"
                        >
                          {user.bannedAt
                            ? t("users.actions.unban")
                            : t("users.actions.ban")}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="admin-page-footer">
        <LanguageSelect className="language-select language-select-admin" />
        <FooterLinks className="footer-links admin-footer-links" />
      </div>
    </main>
  );
}
