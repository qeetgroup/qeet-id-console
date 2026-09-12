import { Button, buttonVariants, cn, Progress, Skeleton, TimeSince } from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  CircleIcon,
  Code2Icon,
  KeyRoundIcon,
  LockKeyholeIcon,
  PackageIcon,
  PlusIcon,
  RefreshCwIcon,
  RocketIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TicketIcon,
  WebhookIcon,
  ZapIcon,
} from "lucide-react";
import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart } from "recharts";

import {
  type DeveloperOverviewData,
  type DeveloperResourceId,
  useDeveloperOverview,
} from "../api/overview";

const RESOURCES = {
  keys: { icon: KeyRoundIcon, path: "/auth/api/keys", brand: true },
  tokens: { icon: TicketIcon, path: "/auth/api/tokens", brand: false },
  webhooks: { icon: WebhookIcon, path: "/developer/webhooks", brand: true },
  hooks: { icon: ZapIcon, path: "/developer/auth-hooks", brand: false },
  agents: { icon: SparklesIcon, path: "/developer/agents", brand: false },
  secrets: { icon: LockKeyholeIcon, path: "/auth/api/secrets", brand: false },
  credentials: { icon: ShieldCheckIcon, path: "/developer/credentials", brand: false },
};

const CHECKLIST: DeveloperResourceId[] = ["keys", "webhooks", "hooks", "agents", "credentials"];
const PANEL =
  "min-w-0 overflow-hidden rounded-lg border border-border/65 bg-card/90 shadow-xs dark:border-border/80 dark:bg-card/70 dark:shadow-none";
const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";
const ACTION =
  "h-9 gap-2 rounded-md px-3.5 text-xs focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11";
const INLINE_LINK =
  "inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-sm text-[11px] font-medium text-muted-foreground outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11";

function OverviewPanel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section className={cn(PANEL, "flex flex-col")} aria-labelledby={headingId}>
      <header className="flex min-h-8 items-center justify-between gap-2 px-3.5 pt-1">
        <h2 id={headingId} className="font-heading text-sm font-semibold">
          {title}
        </h2>
        {action}
      </header>
      <div className="min-w-0 flex-1 px-3.5 pb-2">{children}</div>
    </section>
  );
}

function MetricCard({ resource }: { resource: DeveloperOverviewData["resources"][number] }) {
  const { t, i18n } = useTranslation("developer");
  const headingId = useId();
  const specification = RESOURCES[resource.id];
  const Icon = specification.icon;
  const metric = resource.allowed && !resource.error ? resource.data : undefined;
  const label = t(`overview.metrics.${resource.id}`);
  const color = specification.brand ? "var(--primary)" : "var(--success)";

  return (
    <article
      className={cn(PANEL, "flex min-h-23 flex-col gap-1 p-2.5")}
      aria-labelledby={headingId}
    >
      <header className="flex min-h-6 items-center gap-2">
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground",
            specification.brand && "bg-primary/8 text-primary",
            resource.id === "tokens" && "bg-emerald-500/8 text-emerald-700 dark:text-emerald-400",
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <h2 id={headingId} className="min-w-0 flex-1 text-xs leading-4 font-medium">
          {resource.allowed ? (
            <Link to={specification.path as never} className={cn(FOCUS, "rounded-sm")}>
              {label}
            </Link>
          ) : (
            label
          )}
        </h2>
      </header>
      <div className="flex min-h-7 items-center justify-between gap-2">
        {resource.loading ? (
          <Skeleton
            className="h-7 w-12"
            role="status"
            aria-label={t("overview.loadingMetric", { label })}
          />
        ) : metric ? (
          <p
            className="font-heading text-2xl leading-7 font-semibold tabular-nums"
            title={metric.total.toLocaleString(i18n.resolvedLanguage)}
          >
            {new Intl.NumberFormat(i18n.resolvedLanguage, {
              notation: metric.total >= 10000 ? "compact" : "standard",
              maximumFractionDigits: 1,
            }).format(metric.total)}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t(resource.allowed ? "overview.unavailable" : "overview.restricted")}
          </p>
        )}
        {resource.error ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={resource.busy}
            onClick={() => void resource.retry()}
            aria-label={t("overview.retryMetric", { label })}
          >
            <RefreshCwIcon className="size-3.5" />
          </Button>
        ) : metric?.series.length ? (
          <div className="h-7 w-14 shrink-0" aria-hidden="true">
            <AreaChart
              width={56}
              height={28}
              data={metric.series}
              margin={{ top: 2, right: 1, bottom: 2, left: 1 }}
            >
              <Area
                type="monotone"
                dataKey="count"
                stroke={metric.recent ? color : "var(--muted-foreground)"}
                strokeWidth={1.25}
                fill={color}
                fillOpacity={0.08}
                isAnimationActive={false}
              />
            </AreaChart>
          </div>
        ) : null}
      </div>
      <p className="mt-auto min-h-3 text-[10px] leading-3 text-muted-foreground">
        {metric?.recent != null
          ? t("overview.recentCreations", { count: metric.recent })
          : t("overview.historyUnavailable")}
      </p>
    </article>
  );
}

function DeveloperActivityPanel({ activity }: { activity: DeveloperOverviewData["activity"] }) {
  const { t } = useTranslation("developer");
  return (
    <OverviewPanel
      title={t("overview.activity.title")}
      action={
        activity.allowed ? (
          <Link to="/activity" className={INLINE_LINK}>
            {t("overview.viewAll")} <ArrowRightIcon className="size-3" />
          </Link>
        ) : undefined
      }
    >
      {activity.loading ? (
        <div role="status" aria-label={t("overview.activity.loading")} className="space-y-3 pt-2">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-6 w-full" />
          ))}
        </div>
      ) : activity.error ? (
        <div className="grid min-h-36 place-content-center gap-2 text-center">
          <p className="text-xs text-muted-foreground">{t("overview.activity.error")}</p>
          <Button
            variant="ghost"
            size="sm"
            disabled={activity.busy}
            onClick={() => void activity.retry()}
          >
            <RefreshCwIcon /> {t("overview.retry")}
          </Button>
        </div>
      ) : !activity.allowed || !activity.data?.length ? (
        <p className="grid min-h-36 place-items-center text-center text-xs text-muted-foreground">
          {t(activity.allowed ? "overview.activity.empty" : "overview.activity.restricted")}
        </p>
      ) : (
        <ol className="space-y-0.5">
          {activity.data.map((event) => {
            const specification = RESOURCES[event.area];
            const Icon = specification.icon;
            return (
              <li key={event.id}>
                <Link
                  to={specification.path as never}
                  className={cn(
                    FOCUS,
                    "flex min-h-8 items-center gap-2 rounded-md py-0.5 transition-colors hover:bg-muted/50 pointer-coarse:min-h-11",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground",
                      specification.brand && "bg-primary/8 text-primary",
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] leading-3.5 font-medium">
                      {t("overview.activity.event", {
                        resource: t(`overview.names.${event.area}`),
                        action: t(`overview.activity.verbs.${event.verb}`),
                      })}
                    </span>
                    <span className="block text-[10px] leading-3 text-muted-foreground">
                      {event.targetId
                        ? t("overview.activity.record", { id: event.targetId.slice(0, 8) })
                        : t("overview.activity.organization")}
                    </span>
                  </span>
                  <TimeSince
                    value={event.at}
                    className="shrink-0 text-[10px] text-muted-foreground"
                  />
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </OverviewPanel>
  );
}

function QuickActions({ data }: { data: DeveloperOverviewData }) {
  const { t } = useTranslation("developer");
  const rowClass = cn(
    FOCUS,
    "flex min-h-8 items-center gap-2.5 rounded-md py-0.5 transition-colors hover:bg-muted/50 pointer-coarse:min-h-11",
  );
  const content = (id: string, icon: ReactNode) => (
    <>
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground [&_svg]:size-3.5">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] leading-3.5 font-medium">
          {t(`overview.quick.${id}.title`)}
        </span>
        <span className="block text-[10px] leading-3 text-muted-foreground">
          {t(`overview.quick.${id}.description`)}
        </span>
      </span>
      <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </>
  );

  return (
    <OverviewPanel title={t("overview.quick.title")}>
      <nav aria-label={t("overview.quick.title")} className="space-y-0.5">
        {data.canCreateKey ? (
          <Link to="/auth/api/keys" search={{ action: "create" }} className={rowClass}>
            {content("key", <KeyRoundIcon />)}
          </Link>
        ) : null}
        {data.canCreateWebhook ? (
          <Link to="/developer/webhooks" search={{ action: "create" }} className={rowClass}>
            {content("webhook", <WebhookIcon />)}
          </Link>
        ) : null}
        <a
          href="https://docs.id.qeet.in/docs"
          target="_blank"
          rel="noreferrer"
          className={rowClass}
        >
          {content("docs", <BookOpenIcon />)}
        </a>
        <a
          href="https://docs.id.qeet.in/docs/sdks"
          target="_blank"
          rel="noreferrer"
          className={rowClass}
        >
          {content("sdks", <PackageIcon />)}
        </a>
        <a
          href="https://docs.id.qeet.in/docs/getting-started/quickstart"
          target="_blank"
          rel="noreferrer"
          className={rowClass}
        >
          {content("quickstart", <RocketIcon />)}
        </a>
      </nav>
    </OverviewPanel>
  );
}

function IntegrationChecklist({ data }: { data: DeveloperOverviewData }) {
  const { t } = useTranslation("developer");
  const steps = CHECKLIST.flatMap((id) => {
    const resource = data.resources.find((resource) => resource.id === id && resource.allowed);
    return resource ? [resource] : [];
  });
  const completed = steps.filter((step) => step.data?.configured).length;
  return (
    <OverviewPanel
      title={t("overview.checklist.title")}
      action={
        <span className="text-[10px] text-muted-foreground">
          {t("overview.checklist.progress", { completed, total: steps.length })}
        </span>
      }
    >
      <Progress
        value={steps.length ? (completed / steps.length) * 100 : 0}
        className="mb-1 h-1"
        aria-label={t("overview.checklist.progressLabel")}
      />
      <ol className="space-y-0.5">
        {steps.map((step) => (
          <li key={step.id}>
            <Link
              to={RESOURCES[step.id].path as never}
              className={cn(
                FOCUS,
                "flex min-h-8 items-start gap-2 rounded-md py-0.5 transition-colors hover:bg-muted/50 pointer-coarse:min-h-11",
              )}
            >
              {step.data?.configured ? (
                <CheckCircle2Icon
                  className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
              ) : (
                <CircleIcon
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground/60"
                  aria-hidden="true"
                />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] leading-3.5 font-medium">
                  {t(`overview.checklist.${step.id}.title`)}
                </span>
                <span className="block text-[10px] leading-3 text-muted-foreground">
                  {step.error
                    ? t("overview.unavailable")
                    : t(`overview.checklist.${step.id}.description`)}
                </span>
              </span>
              <span className="sr-only">
                {t(
                  step.data?.configured
                    ? "overview.checklist.complete"
                    : "overview.checklist.pending",
                )}
              </span>
              <ChevronRightIcon
                className="mt-1 size-3 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ol>
      {!steps.length ? (
        <p className="py-8 text-center text-xs text-muted-foreground">
          {t("overview.checklist.restricted")}
        </p>
      ) : null}
    </OverviewPanel>
  );
}

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
          <Code2Icon className="size-8 text-primary" aria-hidden="true" />
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
