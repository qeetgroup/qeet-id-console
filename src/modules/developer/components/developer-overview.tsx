import { buttonVariants, cn } from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, ChevronRightIcon, CodeXmlIcon, PlusIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import { type DeveloperOverviewData, useDeveloperOverview } from "../api/overview";
import { ACTION, FOCUS, INLINE_LINK, PANEL, RESOURCES } from "./developer-overview-config";
import { MetricCard } from "./developer-overview-metric";
import {
  DeveloperActivityPanel,
  IntegrationChecklist,
  QuickActions,
} from "./developer-overview-panels";

export function DeveloperOverview() {
  return <DeveloperOverviewView data={useDeveloperOverview()} />;
}

export function DeveloperOverviewView({ data }: { data: DeveloperOverviewData }) {
  const { t } = useTranslation("developer");
  return (
    <div className="@container/developer-overview relative isolate flex min-w-0 flex-col gap-3 before:pointer-events-none before:absolute before:-inset-4 before:-z-10 before:bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] before:bg-size-[32px_32px] before:opacity-10 dark:before:opacity-5">
      <header className="flex flex-col gap-3 pb-1 @min-[720px]/developer-overview:flex-row @min-[720px]/developer-overview:items-center @min-[720px]/developer-overview:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-[28px] leading-8 font-semibold">
            {t("overview.title")}
          </h1>
          <p className="mt-1 text-xs leading-4 text-muted-foreground">
            {t("overview.description")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {data.canCreateKey ? (
            <Link
              to="/auth/api/keys"
              search={{ action: "create" }}
              className={cn(buttonVariants({ size: "sm" }), ACTION)}
            >
              <PlusIcon className="size-4" /> {t("overview.createKey")}
            </Link>
          ) : null}
          {data.canCreateWebhook ? (
            <Link
              to="/developer/webhooks"
              search={{ action: "create" }}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), ACTION)}
            >
              <PlusIcon className="size-4" /> {t("overview.createWebhook")}
            </Link>
          ) : null}
        </div>
      </header>

      {!data.tenantId || data.accessState !== "ready" ? (
        <section className="grid min-h-64 place-content-center justify-items-center gap-3 border-y border-border/60 px-6 text-center">
          <CodeXmlIcon className="size-8 text-primary" aria-hidden="true" />
          <h2 className="font-heading text-lg font-semibold">
            {t(data.tenantId ? "overview.checkingAccess" : "overview.selectOrganization")}
          </h2>
          <Link to="/" className={INLINE_LINK}>
            {t("overview.goToOverview")} <ArrowRightIcon className="size-3.5" />
          </Link>
        </section>
      ) : (
        <>
          <section
            aria-label={t("overview.metricsLabel")}
            className="grid grid-cols-2 gap-2.5 @min-[520px]/developer-overview:grid-cols-3 @min-[930px]/developer-overview:grid-cols-6"
          >
            {data.resources
              .filter((resource) => resource.id !== "credentials")
              .map((resource) => (
                <MetricCard key={resource.id} resource={resource} />
              ))}
          </section>

          <section className={PANEL} aria-labelledby="developer-explore-title">
            <header className="flex items-center justify-between gap-3 px-4 py-2">
              <div>
                <h2 id="developer-explore-title" className="font-heading text-sm font-semibold">
                  {t("overview.explore.title")}
                </h2>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                  {t("overview.explore.description")}
                </p>
              </div>
              <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                {t("overview.explore.count", { count: data.areas.length })}
              </span>
            </header>
            <nav
              aria-label={t("overview.explore.navigation")}
              className="grid border-t border-border/60 @min-[600px]/developer-overview:grid-cols-2"
            >
              {data.areas.map((area) => (
                <Link
                  key={area.url}
                  to={area.url as never}
                  className={cn(
                    FOCUS,
                    "group flex min-h-11 items-center gap-3 border-b border-border/55 px-4 py-1 transition-colors hover:bg-muted/40 @min-[600px]/developer-overview:odd:border-e",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-md bg-muted/75 text-muted-foreground [&_svg]:size-4",
                      area.url === RESOURCES.keys.path && "bg-primary/8 text-primary",
                    )}
                  >
                    {area.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs leading-4 font-medium">{area.title}</span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                      {area.description}
                    </span>
                  </span>
                  <ChevronRightIcon
                    className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </nav>
            {!data.areas.length ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                {t("overview.explore.restricted")}
              </p>
            ) : null}
          </section>

          <div className="grid gap-3 @min-[840px]/developer-overview:grid-cols-3">
            <DeveloperActivityPanel activity={data.activity} />
            <QuickActions data={data} />
            <IntegrationChecklist data={data} />
          </div>
        </>
      )}
    </div>
  );
}
