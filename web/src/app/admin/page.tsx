import { AdminFinanceRefreshRateSelect } from "@/components/AdminFinanceRefreshRateSelect";
import { AppLogo } from "@/components/AppLogo";
import { FooterLinks } from "@/components/FooterLinks";
import { Button } from "@/components/ui/Button";
import type { NotificationType, Role } from "@/generated/prisma/enums";
import { getFinanceRefreshRateSeconds } from "@/lib/app-settings";
import { getPrisma } from "@/lib/prisma";
import { getCurrentUserProfile } from "@/lib/profile";
import { normalizeDisplayName, validateDisplayName } from "@/lib/profile-rules";
import { unlink } from "fs/promises";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { basename, join, resolve } from "path";

const adminViewOptions = ["users", "notifications"] as const;
const adminSortOptions = ["username", "email", "banned", "admin"] as const;
const notificationSortOptions = ["created", "type", "user", "read"] as const;
const adminRoleOptions = [
  "USER",
  "ANALYST",
  "ADMIN",
] as const satisfies readonly Role[];
const avatarUploadPath = "/uploads/avatars";

type AdminViewOption = (typeof adminViewOptions)[number];
type AdminSortOption = (typeof adminSortOptions)[number];
type NotificationSortOption = (typeof notificationSortOptions)[number];

type AdminPageProps = {
  searchParams?: Promise<{
    dir?: string;
    q?: string;
    sort?: string;
    view?: string;
  }>;
};

function getAdminViewOption(value: string | undefined): AdminViewOption {
  return adminViewOptions.includes(value as AdminViewOption)
    ? (value as AdminViewOption)
    : "users";
}

function getAdminSortOption(value: string | undefined): AdminSortOption {
  return adminSortOptions.includes(value as AdminSortOption)
    ? (value as AdminSortOption)
    : "username";
}

function getNotificationSortOption(
  value: string | undefined
): NotificationSortOption {
  return notificationSortOptions.includes(value as NotificationSortOption)
    ? (value as NotificationSortOption)
    : "created";
}

function getSortDirection(value: string | undefined) {
  return value === "desc" ? "desc" : "asc";
}

function getDefaultSortDirection(option: AdminSortOption) {
  return option === "banned" || option === "admin" ? "desc" : "asc";
}

function getDefaultNotificationSortDirection(option: NotificationSortOption) {
  return option === "created" || option === "read" ? "desc" : "asc";
}

function getSearchQuery(value: string | undefined) {
  return value?.trim() ?? "";
}

function getAvatarDirectory() {
  return join(process.cwd(), "public", "uploads", "avatars");
}

async function deleteLocalAvatar(url: string | null) {
  if (!url?.startsWith(`${avatarUploadPath}/`)) {
    return;
  }

  const avatarDirectory = resolve(getAvatarDirectory());
  const avatarPath = resolve(avatarDirectory, basename(url));

  if (!avatarPath.startsWith(`${avatarDirectory}/`)) {
    return;
  }

  await unlink(avatarPath).catch(() => null);
}

function readFormString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function normalizeEmail(value: FormDataEntryValue | null) {
  return readFormString(value).trim().toLowerCase();
}

function isValidEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isAdminRole(value: FormDataEntryValue | null): value is Role {
  return (
    typeof value === "string" &&
    adminRoleOptions.includes(value as (typeof adminRoleOptions)[number])
  );
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

function getNotificationSortHref(
  option: NotificationSortOption,
  currentSort: NotificationSortOption,
  currentDir: string,
  query: string
) {
  const nextDir =
    option === currentSort
      ? currentDir === "asc"
        ? "desc"
        : "asc"
      : getDefaultNotificationSortDirection(option);
  const params = new URLSearchParams({
    dir: nextDir,
    sort: option,
    view: "notifications",
  });

  if (query) {
    params.set("q", query);
  }

  return `/admin?${params.toString()}`;
}

function getAdminViewHref(view: AdminViewOption) {
  const params = new URLSearchParams({
    view,
  });

  return `/admin?${params.toString()}`;
}

function getNotificationTypeLabel(type: NotificationType) {
  return type
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

async function updateUserProfile(formData: FormData) {
  "use server";

  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "ADMIN") {
    notFound();
  }

  const userId = formData.get("userId");
  const email = normalizeEmail(formData.get("email"));
  const rawDisplayName = formData.get("displayName");
  const displayName = normalizeDisplayName(rawDisplayName);

  if (typeof userId !== "string" || userId.length === 0) {
    return;
  }

  if (!isValidEmail(email)) {
    return;
  }

  if (displayName.length > 0) {
    const displayNameValidation = validateDisplayName(displayName);

    if (displayNameValidation.error || !displayNameValidation.value) {
      return;
    }
  }

  const prisma = getPrisma();
  const existingUser = await prisma.user.findFirst({
    where: {
      email,
      id: {
        not: userId,
      },
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    return;
  }

  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      displayName: displayName || null,
      email,
    },
  });

  revalidatePath("/admin");
}

async function updateUserRole(formData: FormData) {
  "use server";

  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "ADMIN") {
    notFound();
  }

  const userId = formData.get("userId");
  const nextRole = formData.get("role");

  if (typeof userId !== "string" || userId.length === 0) {
    return;
  }

  if (!isAdminRole(nextRole)) {
    return;
  }

  const prisma = getPrisma();

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        role: true,
      },
    });

    if (!user || user.role === nextRole) {
      return;
    }

    if (user.role === "ADMIN" && nextRole !== "ADMIN") {
      const adminCount = await tx.user.count({
        where: {
          role: "ADMIN",
        },
      });

      if (adminCount <= 1) {
        return;
      }
    }

    await tx.user.update({
      where: {
        id: userId,
      },
      data: {
        role: nextRole,
      },
    });
  });

  revalidatePath("/admin");
}

async function deleteUser(formData: FormData) {
  "use server";

  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "ADMIN") {
    notFound();
  }

  const userId = formData.get("userId");

  if (typeof userId !== "string" || userId.length === 0) {
    return;
  }

  if (userId === profile.id) {
    return;
  }

  const prisma = getPrisma();
  const deletedAvatarUrl = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        avatarUrl: true,
        role: true,
      },
    });

    if (!user) {
      return null;
    }

    if (user.role === "ADMIN") {
      const adminCount = await tx.user.count({
        where: {
          role: "ADMIN",
        },
      });

      if (adminCount <= 1) {
        return null;
      }
    }

    await tx.user.delete({
      where: {
        id: userId,
      },
    });

    return user.avatarUrl;
  });

  await deleteLocalAvatar(deletedAvatarUrl);
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
  const currentView = getAdminViewOption(params.view);
  const currentSort = getAdminSortOption(params.sort);
  const currentNotificationSort = getNotificationSortOption(params.sort);
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
  const notifications = await prisma.notification.findMany({
    where: query
      ? {
          OR: [
            {
              title: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              body: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              entityType: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              entityId: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              user: {
                displayName: {
                  contains: query,
                  mode: "insensitive" as const,
                },
              },
            },
            {
              user: {
                email: {
                  contains: query,
                  mode: "insensitive" as const,
                },
              },
            },
          ],
        }
      : {},
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      body: true,
      createdAt: true,
      entityId: true,
      entityType: true,
      readAt: true,
      title: true,
      type: true,
      updatedAt: true,
      user: {
        select: {
          displayName: true,
          email: true,
          role: true,
        },
      },
    },
    take: 250,
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
      result =
        Number(b.role === "ADMIN") - Number(a.role === "ADMIN") || byUsername;
    }

    return currentDir === "desc" ? -result : result;
  });
  const sortedNotifications = notifications.toSorted((a, b) => {
    const byCreated = b.createdAt.getTime() - a.createdAt.getTime();
    const byUser =
      (a.user.displayName ?? "").localeCompare(
        b.user.displayName ?? "",
        locale,
        { sensitivity: "base" }
      ) ||
      a.user.email.localeCompare(b.user.email, locale, { sensitivity: "base" });

    let result = byCreated;

    if (currentNotificationSort === "type") {
      result =
        a.type.localeCompare(b.type, locale, { sensitivity: "base" }) ||
        byCreated;
    } else if (currentNotificationSort === "user") {
      result = byUser || byCreated;
    } else if (currentNotificationSort === "read") {
      result =
        Number(Boolean(b.readAt)) - Number(Boolean(a.readAt)) || byCreated;
    }

    return currentDir === "desc" ? result : -result;
  });
  const adminCount = users.filter((user) => user.role === "ADMIN").length;

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
          <div className="admin-view-switch" role="tablist">
            {adminViewOptions.map((view) => (
              <Link
                aria-selected={currentView === view}
                className={`admin-view-switch-button${
                  currentView === view ? " admin-view-switch-button-active" : ""
                }`}
                href={getAdminViewHref(view)}
                key={view}
                role="tab"
              >
                {t(`views.${view}`)}
              </Link>
            ))}
          </div>

          {currentView === "users" ? (
            <>
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
            <Button type="submit" variant="plain">
              {t("users.search.submit")}
            </Button>
            {query ? (
              <Link className="admin-user-search-reset" href="/admin">
                {t("users.search.clear")}
              </Link>
            ) : null}
          </form>

          <div className="admin-users-list">
            {sortedUsers.map((user) => {
              const isLastAdmin = user.role === "ADMIN" && adminCount <= 1;

              return (
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
                    <form
                      action={updateUserProfile}
                      className="admin-user-profile-form"
                    >
                      <input name="userId" type="hidden" value={user.id} />
                      <label>
                        <span>{t("users.actions.displayNameLabel")}</span>
                        <input
                          defaultValue={user.displayName ?? ""}
                          maxLength={32}
                          minLength={3}
                          name="displayName"
                          placeholder={t("users.unnamed")}
                          type="text"
                        />
                      </label>
                      <label>
                        <span>{t("users.actions.emailLabel")}</span>
                        <input
                          defaultValue={user.email}
                          name="email"
                          required
                          type="email"
                        />
                      </label>
                      <Button
                        className="admin-user-action-button"
                        type="submit"
                        variant="plain"
                      >
                        {t("users.actions.updateProfile")}
                      </Button>
                    </form>

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

                    <form
                      action={updateUserRole}
                      className="admin-user-actions"
                    >
                      <input name="userId" type="hidden" value={user.id} />
                      <label className="admin-user-role-select">
                        <span>{t("users.actions.roleLabel")}</span>
                        <select
                          defaultValue={user.role}
                          disabled={isLastAdmin}
                          name="role"
                        >
                          {adminRoleOptions.map((role) => (
                            <option key={role} value={role}>
                              {t(`users.roles.${role.toLowerCase()}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button
                        className="admin-user-action-button"
                        disabled={isLastAdmin}
                        type="submit"
                        variant="plain"
                      >
                        {t("users.actions.updateRole")}
                      </Button>
                    </form>

                    <form
                      action={toggleUserBan}
                      className="admin-user-actions"
                    >
                      <input name="userId" type="hidden" value={user.id} />
                      <input
                        name="banAction"
                        type="hidden"
                        value={user.bannedAt ? "unban" : "ban"}
                      />
                      <Button
                        className={
                          user.bannedAt
                            ? "admin-user-action-button"
                            : "admin-user-action-button admin-user-action-button-danger"
                        }
                        disabled={user.id === profile.id}
                        type="submit"
                        variant="plain"
                      >
                        {user.bannedAt
                          ? t("users.actions.unban")
                          : t("users.actions.ban")}
                      </Button>
                    </form>

                    <form
                      action={deleteUser}
                      className="admin-user-actions"
                    >
                      <input name="userId" type="hidden" value={user.id} />
                      <Button
                        className="admin-user-action-button admin-user-action-button-danger"
                        disabled={user.id === profile.id || isLastAdmin}
                        type="submit"
                        variant="plain"
                      >
                        {t("users.actions.delete")}
                      </Button>
                    </form>
                  </div>
              </details>
              );
            })}
          </div>
            </>
          ) : (
            <>
              <div className="admin-panel-heading">
                <div>
                  <h2>
                    {t("notifications.title")}
                    <span className="admin-user-count">
                      {t("notifications.total", {
                        count: sortedNotifications.length,
                      })}
                    </span>
                  </h2>
                </div>
                <div className="admin-panel-actions">
                  <div
                    aria-label={t("notifications.sort.button")}
                    className="admin-sort-bar"
                    role="group"
                  >
                    {notificationSortOptions.map((option) => (
                      <Link
                        aria-current={
                          currentNotificationSort === option
                            ? "page"
                            : undefined
                        }
                        className={`admin-sort-button${
                          currentNotificationSort === option
                            ? " admin-sort-button-active"
                            : ""
                        }`}
                        href={getNotificationSortHref(
                          option,
                          currentNotificationSort,
                          currentDir,
                          query
                        )}
                        key={option}
                      >
                        <span>{t(`notifications.sort.options.${option}`)}</span>
                        {currentNotificationSort === option ? (
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
                <input name="view" type="hidden" value="notifications" />
                <input
                  name="sort"
                  type="hidden"
                  value={currentNotificationSort}
                />
                <input name="dir" type="hidden" value={currentDir} />
                <label>
                  <span>{t("notifications.search.label")}</span>
                  <input
                    defaultValue={query}
                    name="q"
                    placeholder={t("notifications.search.placeholder")}
                    type="search"
                  />
                </label>
                <Button type="submit" variant="plain">
                  {t("notifications.search.submit")}
                </Button>
                {query ? (
                  <Link
                    className="admin-user-search-reset"
                    href="/admin?view=notifications"
                  >
                    {t("notifications.search.clear")}
                  </Link>
                ) : null}
              </form>

              <div className="admin-users-list">
                {sortedNotifications.map((notification) => (
                  <details className="admin-user-row" key={notification.id}>
                    <summary className="admin-user-summary admin-notification-summary">
                      <div className="admin-user-identity">
                        <strong>{notification.title}</strong>
                        <span>
                          {notification.user.displayName?.trim() ||
                            notification.user.email}
                        </span>
                      </div>

                      <span className="admin-user-badges">
                        <span className="admin-role-badge admin-role-badge-analyst">
                          {getNotificationTypeLabel(notification.type)}
                        </span>

                        <span
                          className={`admin-status-badge ${
                            notification.readAt
                              ? "admin-status-badge-active"
                              : "admin-status-badge-banned"
                          }`}
                        >
                          {notification.readAt
                            ? t("notifications.status.read")
                            : t("notifications.status.unread")}
                        </span>
                      </span>
                    </summary>

                    <div className="admin-user-details">
                      <dl className="admin-user-detail-grid admin-notification-detail-grid">
                        <div>
                          <dt>{t("notifications.columns.user")}</dt>
                          <dd>{notification.user.email}</dd>
                        </div>
                        <div>
                          <dt>{t("notifications.columns.role")}</dt>
                          <dd>{notification.user.role}</dd>
                        </div>
                        <div>
                          <dt>{t("notifications.columns.created")}</dt>
                          <dd>{dateFormatter.format(notification.createdAt)}</dd>
                        </div>
                        <div>
                          <dt>{t("notifications.columns.updated")}</dt>
                          <dd>{dateFormatter.format(notification.updatedAt)}</dd>
                        </div>
                        <div>
                          <dt>{t("notifications.columns.entityType")}</dt>
                          <dd>{notification.entityType || commonT("na")}</dd>
                        </div>
                        <div>
                          <dt>{t("notifications.columns.entityId")}</dt>
                          <dd>{notification.entityId || commonT("na")}</dd>
                        </div>
                        <div>
                          <dt>{t("notifications.columns.readAt")}</dt>
                          <dd>
                            {notification.readAt
                              ? dateFormatter.format(notification.readAt)
                              : commonT("na")}
                          </dd>
                        </div>
                        <div>
                          <dt>{t("notifications.columns.type")}</dt>
                          <dd>{notification.type}</dd>
                        </div>
                      </dl>

                      <div className="admin-notification-body">
                        <span>{t("notifications.columns.body")}</span>
                        <p>{notification.body || commonT("na")}</p>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <div className="admin-page-footer">
        <FooterLinks className="footer-links admin-footer-links" />
      </div>
    </main>
  );
}
