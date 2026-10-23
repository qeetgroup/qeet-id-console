import {
  Badge,
  buttonVariants,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { formatLocale } from "@/i18n";
import { DataState } from "@/platform/components/data-state";
import { StatusPill } from "@/platform/components/status-pill";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { formatDateTime } from "@/shared/utils/format";
import { useTranslation } from "react-i18next";

import { authPolicyQueries } from "@/modules/authentication";
import { useAnalyticsOverview } from "@/modules/dashboard";
import { formatMoney, useInvoices, useSubscription } from "@/modules/billing";
import { type Org, useOrgAudit, useOrgMembers } from "../api/orgs";

export function OverviewTab({ org, isActive }: { org: Org; isActive: boolean }) {
  const { t } = useTranslation("organizations");
  const analyticsQ = useAnalyticsOverview(isActive);
  const k = analyticsQ.data?.kpis;
  const mfaPct =
    org.member_count && org.member_count > 0
      ? Math.round(((org.mfa_enabled_count ?? 0) / org.member_count) * 1000) / 10
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("detail.identity")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border/50">
              <InfoRow label={t("tenants.edit.name")} value={org.name} />
              <InfoRow label={t("tenants.edit.slug")}>
                <span className="font-mono text-xs">{org.slug}</span>
              </InfoRow>
              <InfoRow label={t("preview.plan")}>
                <Badge variant="muted" className="capitalize">
                  {org.plan}
                </Badge>
              </InfoRow>
              <InfoRow label={t("preview.region")} value={org.region || "—"} />
              <InfoRow label={t("tenants.columns.status")}>
                <StatusPill status={org.status} dot />
              </InfoRow>
              <InfoRow label={t("preview.created")} value={formatDateTime(org.created_at)} />
              <InfoRow label={t("detail.updated")} value={formatDateTime(org.updated_at)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("detail.membersSummary")}</CardTitle>
            <CardDescription>{t("detail.membersSummaryDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Stat label={t("preview.members")} value={org.member_count ?? 0} />
              <Stat
                label={t("kpi.mfaMembers")}
                value={org.mfa_enabled_count ?? 0}
                sub={`${mfaPct}%`}
              />
              {isActive ? (
                <>
                  <Stat
                    label={t("detail.mau")}
                    value={k?.mau.value ?? 0}
                    loading={analyticsQ.isLoading}
                  />
                  <Stat
                    label={t("detail.mfaAdoption")}
                    value={k ? `${Math.round(k.mfa_adoption_pct.value)}%` : "—"}
                    loading={analyticsQ.isLoading}
                  />
                </>
              ) : null}
            </div>
            {!isActive ? (
              <Callout className="mt-4">{t("detail.overviewSwitchHint")}</Callout>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function MembersTab({ orgId }: { orgId: string }) {
  const { t } = useTranslation("organizations");
  const membersQ = useOrgMembers(orgId, true);
  const items = membersQ.data?.items ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("detail.tabs.members")}</CardTitle>
        <CardDescription>{t("detail.membersDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <DataState
          isLoading={membersQ.isLoading}
          isError={membersQ.isError}
          isEmpty={items.length === 0}
          emptyTitle={t("detail.membersEmpty")}
          skeletonRows={4}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("detail.memberCols.user")}</TableHead>
                <TableHead>{t("detail.memberCols.roles")}</TableHead>
                <TableHead>{t("tenants.columns.status")}</TableHead>
                <TableHead>{t("detail.memberCols.mfa")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Link
                      to="/users/$userId"
                      params={{ userId: m.id }}
                      className="font-medium hover:underline"
                    >
                      {m.display_name || m.email}
                    </Link>
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {(m.roles ?? []).join(", ") || "—"}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={m.status} dot />
                  </TableCell>
                  <TableCell>
                    {m.mfa_enabled ? (
                      <Badge variant="success">{t("detail.on")}</Badge>
                    ) : (
                      <Badge variant="warning">{t("detail.off")}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataState>
        <div className="border-t px-4 py-3">
          <Link to="/users" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            {t("detail.manageMembers")}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function SecurityTab({ orgId }: { orgId: string }) {
  const { t } = useTranslation("organizations");
  const policyQ = useQuery({ ...authPolicyQueries.detail(orgId), staleTime: 60_000 });
  const p = policyQ.data;
  const method = (on: boolean) =>
    on ? (
      <Badge variant="success">{t("detail.enabled")}</Badge>
    ) : (
      <Badge variant="muted">{t("detail.disabled")}</Badge>
    );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("detail.loginMethods")}</CardTitle>
          <CardDescription>{t("detail.loginMethodsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataState isLoading={policyQ.isLoading} isEmpty={false} skeletonRows={5}>
            {p ? (
              <div className="divide-y divide-border/50">
                <InfoRow label={t("detail.password")}>{method(p.password_enabled)}</InfoRow>
                <InfoRow label={t("detail.passkeys")}>{method(p.passkey_enabled)}</InfoRow>
                <InfoRow label={t("detail.magicLink")}>{method(p.magic_link_enabled)}</InfoRow>
                <InfoRow label={t("detail.selfReg")}>{method(p.self_registration_enabled)}</InfoRow>
              </div>
            ) : null}
          </DataState>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("detail.passwordPolicy")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataState isLoading={policyQ.isLoading} isEmpty={false} skeletonRows={4}>
            {p ? (
              <div className="divide-y divide-border/50">
                <InfoRow label={t("detail.minLength")} value={String(p.password_min_length)} />
                <InfoRow label={t("detail.reqUpper")}>
                  {method(p.password_require_uppercase)}
                </InfoRow>
                <InfoRow label={t("detail.reqNumber")}>{method(p.password_require_number)}</InfoRow>
                <InfoRow label={t("detail.reqSymbol")}>{method(p.password_require_symbol)}</InfoRow>
              </div>
            ) : null}
          </DataState>
        </CardContent>
      </Card>
    </div>
  );
}

export function BillingTab() {
  const { t } = useTranslation("organizations");
  const subQ = useSubscription();
  const invQ = useInvoices();
  const sub = subQ.data;
  const invoices = invQ.data?.items ?? [];
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("detail.subscription")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataState
            isLoading={subQ.isLoading}
            isEmpty={!sub}
            emptyTitle={t("detail.noSubscription")}
          >
            {sub ? (
              <div className="divide-y divide-border/50">
                <InfoRow label={t("preview.plan")} value={sub.plan_name} />
                <InfoRow label={t("tenants.columns.status")}>
                  <Badge variant="muted">{sub.status}</Badge>
                </InfoRow>
                <InfoRow
                  label={t("detail.amount")}
                  value={formatMoney(sub.amount_minor, sub.currency)}
                />
                <InfoRow
                  label={t("detail.renews")}
                  value={formatDateTime(sub.current_period_end)}
                />
              </div>
            ) : null}
          </DataState>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("detail.invoices")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataState
            isLoading={invQ.isLoading}
            isEmpty={invoices.length === 0}
            emptyTitle={t("detail.noInvoices")}
            skeletonRows={3}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("detail.invoiceCols.date")}</TableHead>
                  <TableHead>{t("detail.invoiceCols.amount")}</TableHead>
                  <TableHead>{t("tenants.columns.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(inv.issued_at)}
                    </TableCell>
                    <TableCell>{formatMoney(inv.amount_minor, inv.currency)}</TableCell>
                    <TableCell>
                      <Badge variant="muted">{inv.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataState>
        </CardContent>
      </Card>
    </div>
  );
}

export function ActivityTab({ orgId }: { orgId: string }) {
  const { t } = useTranslation("organizations");
  const auditQ = useOrgAudit(orgId, true);
  const items = auditQ.data?.items ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("detail.tabs.activity")}</CardTitle>
        <CardDescription>{t("detail.activityDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <DataState
          isLoading={auditQ.isLoading}
          isError={auditQ.isError}
          isEmpty={items.length === 0}
          emptyTitle={t("detail.activityEmpty")}
          skeletonRows={4}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("detail.auditCols.action")}</TableHead>
                <TableHead>{t("detail.auditCols.resource")}</TableHead>
                <TableHead>{t("detail.auditCols.ip")}</TableHead>
                <TableHead>{t("detail.auditCols.when")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.action}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.resource_type}
                    {e.resource_id ? (
                      <span className="ml-1 font-mono text-xs">({e.resource_id.slice(0, 8)}…)</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {e.ip ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <TimeSince value={e.created_at} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataState>
      </CardContent>
    </Card>
  );
}

function InfoRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{children ?? value}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      {loading ? (
        <Skeleton className="mt-1 h-6 w-16" />
      ) : (
        <div className="text-xl font-semibold tabular-nums">
          {typeof value === "number" ? value.toLocaleString(formatLocale()) : value}
        </div>
      )}
      {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
