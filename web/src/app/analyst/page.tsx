import { AppLogo } from "@/components/AppLogo";
import { requireRole } from "@/lib/admin-auth";
import { getPrisma } from "@/lib/prisma";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

function toPercentScore(score: number) {
  return Math.round(score <= 1 ? score * 100 : score);
}

export default async function AnalystPage() {
  const { profile, response } = await requireRole(["ADMIN", "ANALYST"]);

  if (response?.status === 401) {
    redirect("/login");
  }

  if (!profile) {
    notFound();
  }

  const t = await getTranslations("analystPage");
  const dashboardT = await getTranslations("dashboard");
  const commonT = await getTranslations("common");
  const locale = await getLocale();
  const prisma = getPrisma();
  const [
    totalAnalyses,
    completedAnalyses,
    queuedAnalyses,
    runningAnalyses,
    failedAnalyses,
    totalReports,
    trackedAssets,
    recentAnalyses,
  ] = await Promise.all([
    prisma.analysis.count(),
    prisma.analysis.count({ where: { status: "SUCCEEDED" } }),
    prisma.analysis.count({ where: { status: "QUEUED" } }),
    prisma.analysis.count({ where: { status: "RUNNING" } }),
    prisma.analysis.count({ where: { status: "FAILED" } }),
    prisma.report.count(),
    prisma.asset.count({
      where: {
        analyses: {
          some: {},
        },
      },
    }),
    prisma.analysis.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        status: true,
        trendLabel: true,
        recommendation: true,
        confidenceScore: true,
        createdAt: true,
        asset: {
          select: {
            name: true,
            symbol: true,
          },
        },
        user: {
          select: {
            displayName: true,
            email: true,
          },
        },
      },
      take: 6,
    }),
  ]);
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const completionRate =
    totalAnalyses > 0
      ? Math.round((completedAnalyses / totalAnalyses) * 100)
      : 0;
  const activeQueue = queuedAnalyses + runningAnalyses;
  const metricCards = [
    {
      label: t("metrics.totalAnalyses"),
      value: totalAnalyses.toLocaleString(locale),
    },
    {
      label: t("metrics.completionRate"),
      value: t("metrics.percent", {
        value: completionRate,
      }),
    },
    {
      label: t("metrics.activeQueue"),
      value: activeQueue.toLocaleString(locale),
    },
    {
      label: t("metrics.failedAnalyses"),
      value: failedAnalyses.toLocaleString(locale),
    },
    {
      label: t("metrics.trackedAssets"),
      value: trackedAssets.toLocaleString(locale),
    },
    {
      label: t("metrics.reports"),
      value: totalReports.toLocaleString(locale),
    },
  ];

  return (
    <main className="analyst-page">
      <header className="api-docs-header">
        <AppLogo
          ariaLabel={dashboardT("logoAria")}
          href="/dashboard"
          size="small"
        />

        <a className="secondary-link-button" href="/dashboard">
          {commonT("dashboard")}
        </a>
      </header>

      <section className="api-docs-content">
        <div>
          <p className="app-eyebrow">{t("eyebrow")}</p>
          <h1>{t("title")}</h1>
          <p className="api-docs-description">{t("description")}</p>
        </div>

        <div className="analyst-card-grid">
          <article className="analyst-summary-panel">
            <p className="app-eyebrow">{t("cards.role")}</p>
            <h2>{profile.role}</h2>
            <p>{t("cards.scopeValue")}</p>
          </article>

          {metricCards.map((metric) => (
            <article className="analyst-metric-card" key={metric.label}>
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </div>

        <section className="analyst-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>{t("recent.title")}</h2>
              <p>{t("recent.description")}</p>
            </div>
          </div>

          <div className="analyst-run-list">
            {recentAnalyses.length > 0 ? (
              recentAnalyses.map((analysis) => (
                <article className="analyst-run-row" key={analysis.id}>
                  <div>
                    <strong>
                      {analysis.asset.symbol}
                      {analysis.asset.name ? ` - ${analysis.asset.name}` : ""}
                    </strong>
                    <span>
                      {analysis.user.displayName?.trim() || analysis.user.email}
                    </span>
                  </div>

                  <dl>
                    <div>
                      <dt>{t("recent.columns.status")}</dt>
                      <dd>{t(`statuses.${analysis.status.toLowerCase()}`)}</dd>
                    </div>
                    <div>
                      <dt>{t("recent.columns.trend")}</dt>
                      <dd>
                        {analysis.trendLabel
                          ? t(`trends.${analysis.trendLabel.toLowerCase()}`)
                          : commonT("na")}
                      </dd>
                    </div>
                    <div>
                      <dt>{t("recent.columns.recommendation")}</dt>
                      <dd>
                        {analysis.recommendation
                          ? t(
                              `recommendations.${analysis.recommendation.toLowerCase()}`
                            )
                          : commonT("na")}
                      </dd>
                    </div>
                    <div>
                      <dt>{t("recent.columns.confidence")}</dt>
                      <dd>
                        {typeof analysis.confidenceScore === "number"
                          ? t("metrics.percent", {
                              value: toPercentScore(analysis.confidenceScore),
                            })
                          : commonT("na")}
                      </dd>
                    </div>
                    <div>
                      <dt>{t("recent.columns.created")}</dt>
                      <dd>{dateFormatter.format(analysis.createdAt)}</dd>
                    </div>
                  </dl>
                </article>
              ))
            ) : (
              <p className="analyst-empty-state">{t("recent.empty")}</p>
            )}
          </div>
        </section>

        <div className="analyst-status-grid">
          <article>
            <span>{t("statuses.queued")}</span>
            <strong>{queuedAnalyses.toLocaleString(locale)}</strong>
          </article>
          <article>
            <span>{t("statuses.running")}</span>
            <strong>{runningAnalyses.toLocaleString(locale)}</strong>
          </article>
          <article>
            <span>{t("statuses.succeeded")}</span>
            <strong>{completedAnalyses.toLocaleString(locale)}</strong>
          </article>
          <article>
            <span>{t("statuses.failed")}</span>
            <strong>{failedAnalyses.toLocaleString(locale)}</strong>
          </article>
        </div>
      </section>
    </main>
  );
}
