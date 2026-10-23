import { Button, cn, Progress, Skeleton, TimeSince } from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  BookOpenIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  CircleIcon,
  KeyRoundIcon,
  PackageIcon,
  RefreshCwIcon,
  RocketIcon,
  WebhookIcon,
} from "@qeetrix/icons";
import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";

import type { DeveloperOverviewData } from "../api/overview";
import { CHECKLIST, FOCUS, INLINE_LINK, PANEL, RESOURCES } from "./developer-overview-config";

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

/** Renders the recent developer activity feed. */
export function DeveloperActivityPanel({
  activity,
}: {
  activity: DeveloperOverviewData["activity"];
}) {
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

/** Renders the create shortcuts the person may use and the documentation links. */
export function QuickActions({ data }: { data: DeveloperOverviewData }) {
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

/** Renders the integration checklist: which of the resources the person can see are set up. */
export function IntegrationChecklist({ data }: { data: DeveloperOverviewData }) {
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
                <CircleCheckIcon
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
