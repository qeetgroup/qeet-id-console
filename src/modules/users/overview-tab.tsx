import {
  Activity,
  ArrowRight,
  Key,
  ShieldSecurity,
  SmsNotification,
  TickCircle,
} from "@qeetrix/icons";
// The Overview tab — the "answer the 5 questions at a glance" surface: security
// posture, identity, access, recent activity, recommendations, and danger zone.

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  DataState,
  EmptyState,
  StatusPill,
  TimeSince,
} from "@qeetrix/ui";
import { useTranslation } from "react-i18next";
import { formatDateTime } from "@/shared/utils/format";

import { ReadOnlyNotice } from "@/platform/security/read-only-notice";
import type {
  AccessSummary,
  RecentActivityEvent,
  SecuritySummary,
  UserDetail,
} from "./api/user360";
import { DangerZone } from "./danger-zone";
import { SecurityPosture } from "./posture-tiles";
import { CountRow, InfoRow } from "./user-detail-fields";
import type { User360Tab } from "./tabs";
import type { UserRisk } from "./user-risk";

const SEVERITY_DOT: Record<string, string> = {
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-destructive",
  critical: "bg-destructive",
};

export function OverviewTab({
  user,
  security,
  securityLoading,
  risk,
  riskLoading,
  access,
  accessLoading,
  permissionsCount,
  recent,
  recentLoading,
  recentError,
  canWrite,
  canViewActivity,
  onTab,
}: {
  user: UserDetail;
  security?: SecuritySummary;
  securityLoading: boolean;
  risk?: UserRisk;
  riskLoading: boolean;
  access?: AccessSummary;
  accessLoading: boolean;
  permissionsCount: number;
  recent: RecentActivityEvent[];
  recentLoading: boolean;
  recentError: boolean;
  canWrite: boolean;
  canViewActivity: boolean;
  onTab: (tab: User360Tab) => void;
}) {
  const { t } = useTranslation("users");

  return (
    <div className="flex flex-col gap-6">
      {/* Security posture */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">{t("detail.postureTitle")}</h2>
        <SecurityPosture
          email={user.email}
          emailVerified={!!user.email_verified_at}
          security={security}
          securityLoading={securityLoading}
          risk={risk}
          riskLoading={riskLoading}
        />
      </section>

      {/* Identity · Access · Recent activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <IdentityCard user={user} onTab={onTab} />
        <AccessSummaryCard
          access={access}
          loading={accessLoading}
          permissionsCount={permissionsCount}
          onTab={onTab}
        />
        <RecentActivityCard
          recent={recent}
          loading={recentLoading}
          error={recentError}
          canView={canViewActivity}
          onTab={onTab}
        />
      </div>

      {/* Recommendations */}
      <SecurityRecommendations user={user} security={security} risk={risk} onTab={onTab} />

      {/* Danger zone */}
      {canWrite ? (
        <DangerZone userId={user.id} email={user.email} suspended={user.status === "suspended"} />
      ) : (
        <ReadOnlyNotice />
      )}
    </div>
  );
}

// ── Identity card ───────────────────────────────────────────────────────────────

function IdentityCard({ user, onTab }: { user: UserDetail; onTab: (t: User360Tab) => void }) {
  const { t } = useTranslation("users");
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-base">{t("detail.identityTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="flex-1 divide-y divide-border/50">
          <InfoRow label={t("detail.primaryEmail")}>
            <span className="inline-flex items-center gap-1.5">
              <span className="truncate">{user.email}</span>
              {user.email_verified_at ? (
                <Badge variant="success" className="gap-1">
                  <TickCircle className="size-3" aria-hidden="true" />
                  {t("detail.verified")}
                </Badge>
              ) : (
                <Badge variant="warning">{t("detail.unverified")}</Badge>
              )}
            </span>
          </InfoRow>
          <InfoRow label={t("detail.phone")}>
            {user.phone ? (
              user.phone
            ) : (
              <span className="text-muted-foreground">{t("detail.notConfigured")}</span>
            )}
          </InfoRow>
          <InfoRow label={t("detail.userStatus")}>
            <StatusPill status={user.status} dot />
          </InfoRow>
          <InfoRow label={t("detail.fieldEmailVerified")}>
            {formatDateTime(user.email_verified_at)}
          </InfoRow>
          <InfoRow label={t("detail.fieldCreated")}>{formatDateTime(user.created_at)}</InfoRow>
          <InfoRow label={t("detail.fieldLastUpdated")}>{formatDateTime(user.updated_at)}</InfoRow>
          <InfoRow label={t("detail.fieldUserId")}>
            <span className="font-mono text-xs">{user.id}</span>
          </InfoRow>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 w-full"
          onClick={() => onTab("developer")}
        >
          {t("detail.viewFullIdentity")}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Access summary card ─────────────────────────────────────────────────────────

function AccessSummaryCard({
  access,
  loading,
  permissionsCount,
  onTab,
}: {
  access?: AccessSummary;
  loading: boolean;
  permissionsCount: number;
  onTab: (t: User360Tab) => void;
}) {
  const { t } = useTranslation("users");
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-base">{t("detail.accessTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <DataState isLoading={loading} isEmpty={false} skeletonRows={5}>
          <div className="flex-1">
            <CountRow
              label={t("detail.organizations")}
              value={access?.organization ? 1 : 0}
              sub={access?.organization?.name}
            />
            <CountRow label={t("detail.groups")} value={access?.groups.length ?? 0} />
            <CountRow
              label={t("detail.roles")}
              value={access?.roles.length ?? 0}
              sub={access?.roles.map((r) => r.name).join(", ") || undefined}
            />
            <CountRow
              label={t("detail.permissions")}
              value={access?.permissions_total ?? permissionsCount}
              sub={
                access
                  ? t("detail.permissionsSplit", {
                      direct: access.permissions_direct,
                      inherited: access.permissions_inherited,
                    })
                  : t("detail.permissionsSub")
              }
            />
            <CountRow label={t("detail.applications")} value={access?.applications_count ?? 0} />
            <CountRow label={t("detail.policies")} value={access?.policies_count ?? 0} />
          </div>
        </DataState>
        <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => onTab("access")}>
          {t("detail.viewEffectiveAccess")}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Recent activity card ────────────────────────────────────────────────────────

function RecentActivityCard({
  recent,
  loading,
  error,
  canView,
  onTab,
}: {
  recent: RecentActivityEvent[];
  loading: boolean;
  error: boolean;
  canView: boolean;
  onTab: (t: User360Tab) => void;
}) {
  const { t } = useTranslation("users");
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">{t("detail.recentActivityTitle")}</CardTitle>
        <button
          type="button"
          onClick={() => onTab("activity")}
          className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {t("detail.viewAllActivity")}
        </button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {!canView ? (
          <div className="flex flex-1 items-center justify-center py-6">
            <EmptyState
              icon={Activity}
              title={t("detail.activityRestrictedTitle")}
              description={t("detail.activityRestrictedDesc")}
            />
          </div>
        ) : (
          <DataState
            isLoading={loading}
            isError={error}
            isEmpty={recent.length === 0}
            emptyIcon={Activity}
            emptyTitle={t("detail.activityEmpty")}
            skeletonRows={4}
          >
            <ol className="flex-1 space-y-3">
              {recent.map((e) => (
                <li key={e.id} className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      SEVERITY_DOT[e.severity ?? "info"] ?? "bg-muted-foreground",
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{e.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[e.device || e.browser, e.location, e.ip ? `IP ${e.ip}` : null]
                        .filter(Boolean)
                        .join(" · ") || e.description}
                    </div>
                  </div>
                  <TimeSince value={e.at} className="shrink-0 text-xs text-muted-foreground" />
                </li>
              ))}
            </ol>
          </DataState>
        )}
        <Button
          variant="outline"
          size="sm"
          className="mt-4 w-full"
          onClick={() => onTab("activity")}
        >
          {t("detail.viewFullTimeline")}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Security recommendations ────────────────────────────────────────────────────

interface Rec {
  key: string;
  icon: typeof ShieldSecurity;
  title: string;
  description: string;
  recommended?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

function SecurityRecommendations({
  user,
  security,
  risk,
  onTab,
}: {
  user: UserDetail;
  security?: SecuritySummary;
  risk?: UserRisk;
  onTab: (t: User360Tab) => void;
}) {
  const { t } = useTranslation("users");
  const recs: Rec[] = [];

  if (security && !security.mfa_enabled) {
    recs.push({
      key: "mfa",
      icon: ShieldSecurity,
      title: t("detail.rec.mfaTitle"),
      description: t("detail.rec.mfaDesc"),
      recommended: true,
      actionLabel: t("detail.rec.reviewSecurity"),
      onAction: () => onTab("security"),
    });
  }
  if (security?.mfa_enabled && security.recovery_codes_remaining === 0) {
    recs.push({
      key: "recovery",
      icon: Key,
      title: t("detail.rec.recoveryTitle"),
      description: t("detail.rec.recoveryDesc"),
      actionLabel: t("detail.rec.reviewSecurity"),
      onAction: () => onTab("security"),
    });
  }
  if (risk && risk.level !== "low") {
    recs.push({
      key: "risk",
      icon: ShieldSecurity,
      title: t("detail.rec.riskTitle"),
      description: t("detail.rec.riskDesc", { count: risk.openCount }),
      actionLabel: t("detail.rec.investigate"),
      onAction: () => onTab("activity"),
    });
  }
  if (!user.email_verified_at) {
    recs.push({
      key: "email",
      icon: SmsNotification,
      title: t("detail.rec.emailTitle"),
      description: t("detail.rec.emailDesc"),
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-muted-foreground">
        {t("detail.recommendationsTitle")}
      </h2>
      {recs.length === 0 ? (
        <div className="rounded-xl border bg-card p-6">
          <EmptyState
            icon={TickCircle}
            title={t("detail.rec.noneTitle")}
            description={t("detail.rec.noneDesc")}
          />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {recs.map((r) => (
            <div key={r.key} className="flex items-start gap-3 rounded-xl border bg-card p-4">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <r.icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">{r.title}</h3>
                  {r.recommended ? (
                    <Badge variant="warning">{t("detail.rec.recommended")}</Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>
              </div>
              {r.actionLabel && r.onAction ? (
                <Button variant="outline" size="sm" className="shrink-0" onClick={r.onAction}>
                  {r.actionLabel}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
