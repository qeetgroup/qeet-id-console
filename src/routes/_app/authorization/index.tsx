import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  TimeSince,
} from "@qeetrix/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BarChart3Icon,
  CalendarIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  ClockIcon,
  CodeXmlIcon,
  DatabaseIcon,
  InfoIcon,
  KeyRoundIcon,
  LightbulbIcon,
  PlayIcon,
  RocketIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  ShieldXIcon,
  SlidersHorizontalIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UsersRoundIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAbacPolicies } from "@/modules/authorization/api/abac";
import { isAuthzEvent, useAuditEvents } from "@/modules/authorization/api/audit";
import { type PolicyChange, usePolicyChanges } from "@/modules/authorization/api/policy-changes";
import { usePermissions, useRoles } from "@/modules/authorization/api/rbac";
import {
  type CountTrend,
  type PostureFinding,
  auditTrend,
  policyHealth,
  postureFindings,
  resourceCoverage,
  resourceTypes,
} from "@/modules/authorization/authz-posture";
import { PostureRing } from "@/modules/authorization/components/shared/posture-ring";
import { PageHeader } from "@/platform/components/page-header";

export const Route = createFileRoute("/_app/authorization/")({
  component: OverviewPage,
});

const RANGE_DAYS = { "24h": 1, "7d": 7, "30d": 30 } as const;
type RangeKey = keyof typeof RANGE_DAYS;
const RANGES = Object.keys(RANGE_DAYS) as RangeKey[];

const INSIGHT_ROUTES: Record<PostureFinding["id"], string> = {
  wildcard: "/authorization/permissions",
  unconditional: "/authorization/abac",
  disabled: "/authorization/abac",
  deny: "/authorization/abac",
};

function OverviewPage() {
  const { t } = useTranslation("rbac");
  const [range, setRange] = useState<RangeKey>("7d");

  const from = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - RANGE_DAYS[range]);
    return start;
  }, [range]);

  const rolesQ = useRoles();
  const permsQ = usePermissions();
  const policiesQ = useAbacPolicies();
  // The window's authorization events, for the KPI trends.
  const auditQ = useAuditEvents({ limit: 200 });
  const changesQ = usePolicyChanges(from.toISOString());

  const roles = rolesQ.data?.items ?? [];
  const perms = permsQ.data?.items ?? [];
  const policies = policiesQ.data?.items ?? [];
  const loading = rolesQ.isLoading || permsQ.isLoading || policiesQ.isLoading;

  const findings = useMemo(() => postureFindings(perms, policies), [perms, policies]);
  const health = useMemo(() => policyHealth(findings), [findings]);
  const coverage = useMemo(() => resourceCoverage(perms, policies), [perms, policies]);

  const windowEvents = useMemo(
    () =>
      (auditQ.data?.items ?? []).filter((e) => isAuthzEvent(e) && new Date(e.created_at) >= from),
    [auditQ.data, from],
  );

  const denyCount = policies.filter((p) => p.effect === "deny").length;
  const enabledCount = policies.filter((p) => p.enabled).length;
  const systemRoles = roles.filter((r) => r.is_system).length;
  const updatedAt = Math.max(rolesQ.dataUpdatedAt, permsQ.dataUpdatedAt, policiesQ.dataUpdatedAt);

  const dateFormat = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        description={t("overview.description")}
        actions={
          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            <Select value={range} onValueChange={(v) => v && setRange(v as RangeKey)}>
              <SelectTrigger className="w-40" aria-label={t("overview.rangeLabel")}>
                <span className="flex min-w-0 items-center gap-2">
                  <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent>
                {RANGES.map((key) => (
                  <SelectItem key={key} value={key}>
                    {t(`overview.range.${key}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {dateFormat.format(from)} – {dateFormat.format(new Date())}
            </p>
            {updatedAt > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                {t("overview.updated")} <TimeSince value={new Date(updatedAt).toISOString()} />
              </p>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={UsersRoundIcon}
          tone="primary"
          label={t("overview.kpi.roles")}
          value={roles.length}
          hint={t("overview.kpi.rolesHint", { count: systemRoles })}
          trend={auditTrend(windowEvents, "role", roles.length)}
          to="/authorization/roles"
          loading={loading}
        />
        <KpiCard
          icon={KeyRoundIcon}
          tone="info"
          label={t("overview.kpi.permissions")}
          value={perms.length}
          hint={t("overview.kpi.permissionsHint", { count: resourceTypes(perms).length })}
          to="/authorization/permissions"
          loading={loading}
        />
        <KpiCard
          icon={SlidersHorizontalIcon}
          tone="success"
          label={t("overview.kpi.abac")}
          value={policies.length}
          hint={t("overview.kpi.abacHint", { count: enabledCount })}
          badge={policies.length === 0 ? t("overview.kpi.notConfigured") : undefined}
          trend={auditTrend(windowEvents, "abac_policy", policies.length)}
          to="/authorization/abac"
          loading={loading}
        />
        <KpiCard
          icon={ShieldXIcon}
          tone="danger"
          label={t("overview.kpi.deny")}
          value={denyCount}
          hint={t("overview.kpi.denyHint", { count: denyCount })}
          badge={denyCount === 0 ? t("overview.kpi.healthy") : undefined}
          badgeTone="success"
          to="/authorization/abac"
          loading={loading}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader className="gap-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionHeading
                icon={<ShieldCheckIcon className="size-5" />}
                tone="success"
                title={t("overview.health.title")}
                subtitle={t("overview.health.subtitle")}
              />
              <Button variant="outline" size="sm" render={<a href="#security-insights" />}>
                {t("overview.health.recommendations")} <ArrowRightIcon />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-6">
            {loading ? (
              <Skeleton className="size-26 rounded-full" />
            ) : (
              <PostureRing
                value={health.score}
                tone={
                  health.band === "good" ? "success" : health.band === "fair" ? "warning" : "danger"
                }
                ariaLabel={t("overview.health.ringLabel", { score: health.score })}
              >
                <span className="font-heading text-2xl font-semibold">{health.score}</span>
                <span className="mt-1 text-xs text-muted-foreground">/100</span>
              </PostureRing>
            )}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "font-heading text-lg font-semibold",
                  health.band === "good"
                    ? "text-success"
                    : health.band === "fair"
                      ? "text-warning"
                      : "text-destructive",
                )}
              >
                {t(`overview.health.band.${health.band}`)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(`overview.health.bandHint.${health.band}`)}
              </p>
              <div className="mt-4 flex flex-wrap gap-5">
                <HealthCounter
                  tone="bg-destructive"
                  value={health.critical}
                  label={t("overview.health.critical")}
                />
                <HealthCounter
                  tone="bg-warning"
                  value={health.warnings}
                  label={t("overview.health.warnings")}
                />
                <HealthCounter
                  tone="bg-muted-foreground/40"
                  value={health.info}
                  label={t("overview.health.info")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader className="gap-0">
            <SectionHeading
              icon={<DatabaseIcon className="size-5" />}
              tone="primary"
              title={t("overview.coverage.title")}
              subtitle={t("overview.coverage.subtitle")}
            />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4">
              {loading ? (
                <Skeleton className="size-24 rounded-full" />
              ) : (
                <PostureRing
                  value={coverage.percent}
                  tone="primary"
                  size={96}
                  ariaLabel={t("overview.coverage.ringLabel", { percent: coverage.percent })}
                >
                  <span className="font-heading text-lg font-semibold">{coverage.percent}%</span>
                </PostureRing>
              )}
              <div className="min-w-0">
                <p className="font-heading text-xl font-semibold">
                  {coverage.protected} / {coverage.total}
                </p>
                <p className="text-sm text-muted-foreground">{t("overview.coverage.caption")}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-xs">
              <LegendDot
                tone="bg-primary"
                label={t("overview.coverage.protected")}
                value={coverage.protected}
              />
              <LegendDot
                tone="bg-muted-foreground/40"
                label={t("overview.coverage.unprotected")}
                value={coverage.unprotected}
              />
            </div>
            <Link
              to="/authorization/resources"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {t("overview.coverage.viewResources")} <ArrowRightIcon className="size-3.5" />
            </Link>
          </CardContent>
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader className="gap-0">
            <div className="flex items-start justify-between gap-3">
              <SectionHeading
                icon={<ClockIcon className="size-5" />}
                tone="info"
                title={t("overview.changes.title")}
                subtitle={t("overview.changes.subtitle")}
              />
              <Link
                to="/authorization/audit"
                className="shrink-0 text-xs font-medium text-primary hover:underline"
              >
                {t("overview.changes.viewAll")}
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <RecentChanges
              changes={changesQ.data ?? []}
              loading={changesQ.isLoading}
              emptyLabel={t("overview.changes.empty")}
              byLabel={t("overview.changes.by")}
            />
          </CardContent>
        </Card>

        <Card className="xl:col-span-8" id="security-insights">
          <CardHeader className="gap-0">
            <SectionHeading
              icon={<LightbulbIcon className="size-5" />}
              tone="warning"
              title={t("overview.insights.title")}
              subtitle={t("overview.insights.subtitle")}
            />
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {findings.map((finding) => (
              <InsightRow key={finding.id} finding={finding} loading={loading} />
            ))}
          </CardContent>
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader className="gap-0">
            <SectionHeading
              icon={<RocketIcon className="size-5" />}
              tone="primary"
              title={t("overview.build.title")}
              subtitle={t("overview.build.subtitle")}
            />
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <QuickAction
              to="/authorization/roles"
              icon={UsersRoundIcon}
              label={t("overview.build.createRole")}
            />
            <QuickAction
              to="/authorization/permissions"
              icon={KeyRoundIcon}
              label={t("overview.build.addPermission")}
            />
            <QuickAction
              to="/authorization/abac"
              icon={ScrollTextIcon}
              label={t("overview.build.createPolicy")}
            />
            <QuickAction
              to="/authorization/simulator"
              icon={PlayIcon}
              label={t("overview.build.runSimulation")}
            />
            <QuickAction
              to="/authorization/builder"
              icon={CodeXmlIcon}
              label={t("overview.build.openBuilder")}
            />
          </CardContent>
        </Card>

        <Card className="xl:col-span-12">
          <CardHeader className="gap-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionHeading
                icon={<BarChart3Icon className="size-5" />}
                tone="primary"
                title={t("overview.analytics.title")}
                subtitle={t("overview.analytics.subtitle")}
              />
            </div>
          </CardHeader>
          <CardContent>
            {/* No decision metrics exist: the authorization engine emits none and
                there is no endpoint to read. Say so rather than draw empty charts. */}
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 text-center">
              <span className="rounded-full bg-muted p-3">
                <TrendingUpIcon className="size-6 text-muted-foreground" aria-hidden="true" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("overview.analytics.unavailableTitle")}</p>
                <p className="mx-auto max-w-lg text-sm text-muted-foreground">
                  {t("overview.analytics.unavailableBody")}
                </p>
              </div>
              <p className="rounded-md bg-muted/50 px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
                {t("overview.analytics.note")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const CHIP_TONES = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
} as const;

type ChipTone = keyof typeof CHIP_TONES;

function SectionHeading({
  icon,
  tone,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  tone: ChipTone;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          CHIP_TONES[tone],
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-heading text-base font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  tone,
  label,
  value,
  hint,
  badge,
  badgeTone = "muted",
  trend,
  to,
  loading,
}: {
  icon: typeof KeyRoundIcon;
  tone: ChipTone;
  label: string;
  value: number;
  hint: string;
  badge?: string;
  badgeTone?: "muted" | "success";
  trend?: CountTrend | null;
  to: string;
  loading: boolean;
}) {
  return (
    <Link to={to} className="group/kpi min-w-0">
      <Card className="h-full gap-0 transition-colors hover:border-primary/40">
        <CardContent className="flex items-start gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              CHIP_TONES[tone],
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{label}</p>
            {loading ? (
              <Skeleton className="mt-2 h-7 w-16" />
            ) : (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="font-heading text-2xl font-semibold leading-none">{value}</span>
                {trend && <TrendPill trend={trend} />}
                {badge && (
                  <Badge variant={badgeTone} className="font-normal">
                    {badge}
                  </Badge>
                )}
              </div>
            )}
            <p className="mt-1.5 truncate text-xs text-muted-foreground">{hint}</p>
          </div>
          <ChevronRightIcon
            className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/kpi:translate-x-0.5"
            aria-hidden="true"
          />
        </CardContent>
      </Card>
    </Link>
  );
}

/** Change across the selected window, reconstructed from the audit log. */
function TrendPill({ trend }: { trend: CountTrend }) {
  const up = trend.delta >= 0;
  const Icon = up ? TrendingUpIcon : TrendingDownIcon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
        up ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {up ? "+" : ""}
      {trend.percent}%
    </span>
  );
}

function HealthCounter({ tone, value, label }: { tone: string; value: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("size-2 shrink-0 rounded-full", tone)} aria-hidden="true" />
      <span className="font-heading text-base font-semibold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function LegendDot({ tone, label, value }: { tone: string; label: string; value: number }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className={cn("size-2 shrink-0 rounded-full", tone)} aria-hidden="true" />
      {label}
      <span className="font-medium text-foreground">{value}</span>
    </span>
  );
}

const SEVERITY_META = {
  high: { icon: CircleAlertIcon, className: "text-destructive", badge: "destructive" },
  medium: { icon: AlertTriangleIcon, className: "text-warning", badge: "warning" },
  info: { icon: InfoIcon, className: "text-muted-foreground", badge: "muted" },
} as const;

function InsightRow({ finding, loading }: { finding: PostureFinding; loading: boolean }) {
  const { t } = useTranslation("rbac");
  const meta = SEVERITY_META[finding.severity];
  const Icon = meta.icon;

  return (
    <Link
      to={INSIGHT_ROUTES[finding.id]}
      className="group/insight flex items-center gap-3 py-3 first:pt-0 last:pb-0"
    >
      <Icon className={cn("size-4 shrink-0", meta.className)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t(`overview.insights.${finding.id}.title`)}</p>
        <p className="text-xs text-muted-foreground">
          {t(`overview.insights.${finding.id}.description`)}
        </p>
      </div>
      <Badge variant={meta.badge} className="shrink-0 font-normal">
        {t(`overview.insights.severity.${finding.severity}`)}
      </Badge>
      {loading ? (
        <Skeleton className="h-4 w-6" />
      ) : (
        <span className="w-8 shrink-0 text-end font-heading text-sm font-semibold tabular-nums">
          {finding.count}
        </span>
      )}
      <ChevronRightIcon
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/insight:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

const CHANGE_DOTS: Record<PolicyChange["kind"], string> = {
  created: "bg-warning",
  updated: "bg-success",
  deleted: "bg-muted-foreground/40",
  other: "bg-primary",
};

function RecentChanges({
  changes,
  loading,
  emptyLabel,
  byLabel,
}: {
  changes: PolicyChange[];
  loading: boolean;
  emptyLabel: string;
  byLabel: string;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (changes.length === 0) {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <ScrollTextIcon className="size-4" aria-hidden="true" /> {emptyLabel}
      </p>
    );
  }
  return (
    <ul className="flex flex-col">
      {changes.map((change) => (
        <li key={change.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
          <span
            className={cn("mt-1.5 size-2 shrink-0 rounded-full", CHANGE_DOTS[change.kind])}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{change.title}</p>
            {change.target && (
              <p className="truncate font-mono text-xs text-muted-foreground">{change.target}</p>
            )}
          </div>
          <div className="shrink-0 text-end">
            <p className="text-xs text-muted-foreground">
              <TimeSince value={change.at} />
            </p>
            {change.actor && (
              <p className="truncate text-xs text-muted-foreground">
                {byLabel} {change.actor}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof KeyRoundIcon;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="group/action flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted/40"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronRightIcon
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/action:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}
