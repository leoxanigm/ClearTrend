import { AdminFinanceRefreshRateSelect } from "@/components/AdminFinanceRefreshRateSelect";
import { AppLogo } from "@/components/AppLogo";
import { FooterLinks } from "@/components/FooterLinks";
import { LanguageSelect } from "@/components/ui/LanguageSelect";
import { getFinanceRefreshRateSeconds } from "@/lib/app-settings";
import { getPrisma } from "@/lib/prisma";
import { getCurrentUserProfile } from "@/lib/profile";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

const adminSortOptions = ["username", "email", "banned", "admin"] as const;

type AdminSortOption = (typeof adminSortOptions)[number];

type AdminPageProps = {
  searchParams?: Promise<{
    dir?: string;
    q?: string;
    sort?: string;
  }>;
};

function getAdminSortOption(value: string | undefined): AdminSortOption {
  return adminSortOptions.includes(value as AdminSortOption)
    ? (value as AdminSortOption)
    : "username";
}

function getSortDirection(value: string | undefined) {
  return value === "desc" ? "desc" : "asc";
}

function getDefaultSortDirection(option: AdminSortOption) {
  return option === "banned" || option === "admin" ? "desc" : "asc";
}

function getSearchQuery(value: string | undefined) {
  return value?.trim() ?? "";
}

function getSortHref(
  option: AdminSortOption,
  currentSort: AdminSortOption,
  currentDir: string,
  query: string
) {
  const nextDir =
    option === currentSort
      ? currentDir === "asc"
        ? "desc"
        : "asc"
      : getDefaultSortDirection(option);
  const params = new URLSearchParams({
    dir: nextDir,
    sort: option,
  });

  if (query) {
    params.set("q", query);
  }

  return `/admin?${params.toString()}`;
}

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

export default async function AdminPage({ searchParams }: AdminPageProps) {
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
  const params = (await searchParams) ?? {};
  const currentSort = getAdminSortOption(params.sort);
  const currentDir = getSortDirection(params.dir);
  const query = getSearchQuery(params.q);
  const financeRefreshRateSeconds = await getFinanceRefreshRateSeconds();
  const locale = await getLocale();
  const prisma = getPrisma();
  const users = await prisma.user.findMany({
    where: {
      NOT: {
        oauthProvider: "credentials",
        passwordHash: null,
      },
      ...(query
        ? {
            OR: [
              {
                displayName: {
                  contains: query,
                  mode: "insensitive" as const,
                },
              },
              {
                email: {
                  contains: query,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }],
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
          apiKeys: true,
        },
      },
    },
  });
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const sortedUsers = users.toSorted((a, b) => {
    const byUsername =
      (a.displayName ?? "").localeCompare(b.displayName ?? "", locale, {
        sensitivity: "base",
      }) || a.email.localeCompare(b.email, locale, { sensitivity: "base" });

    let result = byUsername;

    if (currentSort === "email") {
      result =
        a.email.localeCompare(b.email, locale, { sensitivity: "base" }) ||
        byUsername;
    } else if (currentSort === "banned") {
      result =
        Number(Boolean(b.bannedAt)) - Number(Boolean(a.bannedAt)) || byUsername;
    } else if (currentSort === "admin") {
      result = Number(b.role === "ADMIN") - Number(a.role === "ADMIN") || byUsername;
    }

    return currentDir === "desc" ? -result : result;
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
          <h1>{t("title")}</h1>
        </div>

        <div className="admin-refresh-rate-row">
          <AdminFinanceRefreshRateSelect
            ariaLabel={t("refreshRate.ariaLabel")}
            initialValue={financeRefreshRateSeconds}
            label={t("refreshRate.label")}
            options={[
              {
                label: t("refreshRate.options.60"),
                value: 60,
              },
              {
                label: t("refreshRate.options.300"),
                value: 300,
              },
              {
                label: t("refreshRate.options.900"),
                value: 900,
              },
            ]}
          />
        </div>

        <div className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>
                {t("users.title")}
                <span className="admin-user-count">
                  {t("users.total", {
                    count: sortedUsers.length,
                  })}
                </span>
              </h2>
            </div>
            <div className="admin-panel-actions">
              <div
                aria-label={t("users.sort.button")}
                className="admin-sort-bar"
                role="group"
              >
                {adminSortOptions.map((option) => (
                  <Link
                    aria-current={currentSort === option ? "page" : undefined}
                    className={`admin-sort-button${
                      currentSort === option ? " admin-sort-button-active" : ""
                    }`}
                    href={getSortHref(option, currentSort, currentDir, query)}
                    key={option}
                  >
                    <span>{t(`users.sort.options.${option}`)}</span>
                    {currentSort === option ? (
                      <span className="admin-sort-arrow" aria-hidden="true">
                        {currentDir === "asc" ? "↑" : "↓"}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <form action="/admin" className="admin-user-search" method="GET">
            <input name="sort" type="hidden" value={currentSort} />
            <input name="dir" type="hidden" value={currentDir} />
            <label>
              <span>{t("users.search.label")}</span>
              <input
                defaultValue={query}
                name="q"
                placeholder={t("users.search.placeholder")}
                type="search"
              />
            </label>
            <button type="submit">{t("users.search.submit")}</button>
            {query ? (
              <Link className="admin-user-search-reset" href="/admin">
                {t("users.search.clear")}
              </Link>
            ) : null}
          </form>

          <div className="admin-users-list">
            {sortedUsers.map((user) => (
              <details className="admin-user-row" key={user.id}>
                <summary className="admin-user-summary">
                  <div className="admin-user-identity">
                    <strong>
                      {user.displayName?.trim() || t("users.unnamed")}
                    </strong>
                    <span>{user.email}</span>
                  </div>

                  <span className="admin-user-badges">
                    <span
                      className={`admin-role-badge admin-role-badge-${user.role.toLowerCase()}`}
                    >
                      {user.role}
                    </span>

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
                  </span>
                </summary>

                <div className="admin-user-details">
                  <dl className="admin-user-detail-grid">
                    <div>
                      <dt>{t("users.columns.provider")}</dt>
                      <dd>
                        {user.oauthProvider || t("users.passwordProvider")}
                      </dd>
                    </div>
                    <div>
                      <dt>{t("users.columns.watchlists")}</dt>
                      <dd>
                        <details className="admin-watchlist-details">
                          <summary>
                            {t("users.watchlistCount", {
                              count: user.favoriteSymbols.length,
                            })}
                          </summary>
                          <p>
                            {user.favoriteSymbols.length > 0
                              ? user.favoriteSymbols.join(", ")
                              : t("users.watchlistEmpty")}
                          </p>
                        </details>
                      </dd>
                    </div>
                    <div>
                      <dt>{t("users.columns.apiKeys")}</dt>
                      <dd>{user._count.apiKeys}</dd>
                    </div>
                    <div>
                      <dt>{t("users.columns.created")}</dt>
                      <dd>{dateFormatter.format(user.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>{t("users.columns.updated")}</dt>
                      <dd>{dateFormatter.format(user.updatedAt)}</dd>
                    </div>
                  </dl>

                  <form action={toggleUserBan} className="admin-user-actions">
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
                </div>
              </details>
            ))}
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
