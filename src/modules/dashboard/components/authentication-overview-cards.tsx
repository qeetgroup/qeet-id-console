import { Badge, buttonVariants, cn, EmptyState, Skeleton, TimeSince } from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import {
  ActivityIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  FingerprintPatternIcon,
  LightbulbIcon,
  LinkIcon,
  MonitorSmartphoneIcon,
  ShareIcon,
  TrendingUpIcon,
  UserRoundIcon,
} from "@qeetrix/icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { AuthPosture, AuthPostureId } from "../authentication-overview-model";
import type { DashboardAuditEvent } from "../use-dashboard-activity";
import { DashboardPanel } from "./dashboard-panel";

const TONES = {
  brand: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
  neutral: "bg-muted text-muted-foreground ring-1 ring-foreground/6",
} as const;

export type Tone = keyof typeof TONES;

export function postureBadge(state: "healthy" | "attention" | "critical") {
  if (state === "healthy") return "success" as const;
  if (state === "attention") return "warning" as const;
  return "destructive" as const;
}

export function actionIcon(id: AuthPostureId): ReactNode {
  switch (id) {
    case "signin":
      return <UserRoundIcon />;
    case "social":
      return <ShareIcon />;
    case "mfa":
      return <FingerprintPatternIcon />;
    case "sso":
      return <LinkIcon />;
    default:
      return <MonitorSmartphoneIcon />;
  }
}

/** Renders the newest five events of the activity feed, or a skeleton while it connects. */
export function RecentAuthActivity({
  activity,
}: {
  activity: { events: DashboardAuditEvent[]; connecting: boolean };
}) {
  const { t } = useTranslation("auth");
  return (
    <DashboardPanel
      title={t("overview.activity.title")}
      description={t("overview.activity.description")}
      action={
        <Link
          to="/activity"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
        >
          {t("overview.activity.viewAll")} <ChevronRightIcon />
        </Link>
      }
    >
      {activity.connecting && activity.events.length === 0 ? (
        <div className="flex flex-col gap-2">
          {["a", "b", "c"].map((k) => (
            <Skeleton key={k} className="h-10 w-full" />
          ))}
        </div>
      ) : activity.events.length === 0 ? (
        <EmptyState
          icon={ActivityIcon}
          title={t("overview.activity.emptyTitle")}
          description={t("overview.activity.emptyDescription")}
        />
      ) : (
        <ol className="flex flex-col">
          {activity.events.slice(0, 5).map((event) => (
            <li
              key={event.id}
              className="flex items-center gap-3 border-b border-border/60 py-2.5 last:border-0"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                <ActivityIcon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{event.title}</span>
              {event.actor?.name ? (
                <span className="hidden shrink-0 truncate text-xs text-muted-foreground sm:block">
                  {event.actor.name}
                </span>
              ) : null}
              <TimeSince
                value={event.at}
                refreshIntervalMs={0}
                className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
              />
            </li>
          ))}
        </ol>
      )}
    </DashboardPanel>
  );
}

export function Callout({ posture }: { posture: AuthPosture }) {
  const { t } = useTranslation("auth");
  const next = posture.pending[0];

  return (
    <div className="mt-4 flex items-start gap-3 rounded-lg border border-primary/15 bg-primary/3 p-3 dark:border-primary/20 dark:bg-primary/5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <LightbulbIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {next ? t("overview.posture.callout.title") : t("overview.posture.callout.allClear")}
        </p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {next
            ? t(`overview.actions.items.${next.id}.description`)
            : t("overview.posture.callout.allClearDetail")}
        </p>
      </div>
      {next ? (
        <Link to={next.to as never} aria-label={t(`overview.actions.items.${next.id}.title`)}>
          <ArrowRightIcon className="mt-1 size-4 shrink-0 text-muted-foreground" />
        </Link>
      ) : null}
    </div>
  );
}

export function Kpi({
  icon,
  tone,
  label,
  value,
  detail,
  loading,
  error,
  delta,
}: {
  icon: ReactNode;
  tone: Tone;
  label: string;
  value: number | string;
  detail: string;
  loading: boolean;
  error: boolean;
  delta?: { value: number; caption: string };
}) {
  const { t } = useTranslation("auth");
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
      <span
        className={cn(
          "mt-0.5 grid size-10 shrink-0 place-items-center rounded-lg [&_svg]:size-4.5",
          TONES[tone],
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="font-heading text-2xl font-semibold tabular-nums">
            {loading ? "—" : error ? "—" : value}
          </span>
          {!loading && !error && delta ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium",
                delta.value >= 0 ? "text-success" : "text-destructive",
              )}
            >
              <TrendingUpIcon className="size-3" />
              {t("dashboard:authenticationOverview.deltaPp", {
                value: `${delta.value >= 0 ? "+" : ""}${delta.value.toFixed(1)}`,
              })}
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {error ? t("overview.states.unavailable") : delta ? delta.caption : detail}
        </p>
      </div>
    </div>
  );
}

export function Area({
  to,
  icon,
  tone,
  title,
  description,
  stat,
  chips,
  wide,
}: {
  to: string;
  icon: ReactNode;
  tone: Tone;
  title: string;
  description: string;
  stat: string;
  chips: string[];
  wide?: boolean;
}) {
  return (
    <Link
      to={to as never}
      className={cn(
        "group flex items-start gap-4 border-t border-border/70 p-5 outline-none transition-colors hover:bg-muted/35 focus-visible:bg-muted/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        wide ? "md:col-span-2" : "md:odd:border-e",
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-lg [&_svg]:size-4.5",
          TONES[tone],
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-sm font-semibold">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span>
        <span className="mt-2 block text-sm font-medium">{stat}</span>
        {chips.length > 0 ? (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <Badge key={c} variant="muted">
                {c}
              </Badge>
            ))}
          </span>
        ) : null}
      </span>
      <ChevronRightIcon className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
