import {
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
import { Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  CalendarIcon,
  ChartColumnIcon,
  ClockIcon,
  CodeXmlIcon,
  DatabaseIcon,
  KeyRoundIcon,
  LightbulbIcon,
  PlayIcon,
  RocketIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  ShieldXIcon,
  SlidersHorizontalIcon,
  TrendingUpIcon,
  UsersRoundIcon,
} from "@qeetrix/icons";
import { useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { useAbacPolicies } from "../api/abac";
import { isAuthzEvent, useAuditEvents } from "../api/audit";
import { usePolicyChanges } from "../api/policy-changes";
import { usePermissions, useRoles } from "../api/rbac";
import {
  auditTrend,
  policyHealth,
  postureFindings,
  resourceCoverage,
  resourceTypes,
} from "../authz-posture";
import { PostureRing } from "./shared/posture-ring";
import { PageHeader } from "@/platform/components/page-header";
import {
  HealthCounter,
  InsightRow,
  KpiCard,
  LegendDot,
  QuickAction,
  RecentChanges,
  SectionHeading,
} from "./authorization-overview-parts";

const RANGE_DAYS = { "24h": 1, "7d": 7, "30d": 30 } as const;

type RangeKey = keyof typeof RANGE_DAYS;

const RANGES = Object.keys(RANGE_DAYS) as RangeKey[];

/** Renders the authorization overview: posture, models in use and recent changes. */
export function AuthorizationOverviewPage() {
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
  const auditQ = useAuditEvents({ limit: 200 }); // the window's authz events, for the KPI trends
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
                <Trans
                  t={t}
                  i18nKey="overview.updatedAgo"
                  components={{ time: <TimeSince value={new Date(updatedAt).toISOString()} /> }}
                />
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
                icon={<ChartColumnIcon className="size-5" />}
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
