import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  buttonVariants,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  DataState,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Skeleton,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TimeSince,
  TooltipProvider,
} from "@qeetrix/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  ArrowLeftRightIcon,
  Building2Icon,
  ChevronDownIcon,
  Trash2Icon,
  UserCheckIcon,
  UserXIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useConfirmDialog } from "@/shared/components/confirm-dialog";
import { useCapabilities } from "@/platform/security/capability-provider";
import { CopyId } from "@/modules/users/user-detail-fields";
import { initials } from "@/modules/users/user-display";
import { useAnalyticsOverview } from "@/modules/dashboard/api/analytics";
import { useTenantId } from "@/platform/auth/session";
import { switchToTenant } from "@/modules/authentication";
import { formatMoney, useInvoices, useSubscription } from "@/modules/billing/api/billing";
import {
  type Org,
  useDeleteOrg,
  useOrg,
  useOrgAudit,
  useOrgAuthPolicy,
  useOrgMembers,
  useUpdateOrg,
} from "@/modules/organizations/api/orgs";

const TABS = ["overview", "members", "security", "billing", "activity"] as const;
type OrgTab = (typeof TABS)[number];

export const Route = createFileRoute("/_app/organizations/$orgId")({
  validateSearch: (search: Record<string, unknown>): { tab?: OrgTab } => ({
    tab: TABS.includes(search.tab as OrgTab) ? (search.tab as OrgTab) : "overview",
  }),
  component: OrgDetailPage,
});

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

function OrgDetailPage() {
  const { t } = useTranslation("organizations");
  const { orgId } = Route.useParams();
  const tab = Route.useSearch().tab ?? "overview";
  const navigate = Route.useNavigate();
  const currentTenantId = useTenantId();
  const isActive = orgId === currentTenantId;
  const access = useCapabilities();
  const canWrite = access.can("tenant.write");

  const { org, isLoading, isError } = useOrg(orgId);
  const updateOrg = useUpdateOrg();
  const deleteOrg = useDeleteOrg();
  const [confirmDialog, openConfirm] = useConfirmDialog();

  const setTab = (next: OrgTab) =>
    navigate({ search: (p) => ({ ...p, tab: next }), replace: true });

  return (
    <TooltipProvider>
      <div className="flex min-w-0 flex-col gap-5">
        {confirmDialog}
        <Link
          to="/organizations/tenants"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-3" aria-hidden="true" /> {t("detail.back")}
        </Link>

        {isLoading && !org ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : isError || !org ? (
          <EmptyState icon={Building2Icon} title={t("detail.notFound")} />
        ) : (
          <>
            <OrgHeader
              org={org}
              isActive={isActive}
              canWrite={canWrite}
              onSuspendToggle={() => {
                if (org.status === "suspended") {
                  updateOrg.mutate({ id: org.id, body: { status: "active" } });
                  return;
                }
                openConfirm({
                  title: t("suspend.title"),
                  description: t("suspend.description", { name: org.name }),
                  variant: "destructive",
                  confirmLabel: t("rowActions.suspend"),
                  onConfirm: () => updateOrg.mutate({ id: org.id, body: { status: "suspended" } }),
                });
              }}
              onDelete={() =>
                openConfirm({
                  title: t("tenants.delete.title"),
                  description: t("delete.description", { name: org.name, slug: org.slug }),
                  variant: "destructive",
                  confirmLabel: t("tenants.delete.delete"),
                  onConfirm: () =>
                    deleteOrg.mutate(org.id, {
                      onSuccess: () => navigate({ to: "/organizations/tenants" }),
                    }),
                })
              }
            />

            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as OrgTab)}
              className="flex min-w-0 flex-col gap-5"
            >
              <TabsList className="w-full justify-start overflow-x-auto">
                {TABS.map((k) => (
                  <TabsTrigger key={k} value={k}>
                    {t(`detail.tabs.${k}`)}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview" className="flex min-w-0 flex-col">
                <OverviewTab org={org} isActive={isActive} />
              </TabsContent>
              <TabsContent value="members" className="flex min-w-0 flex-col">
                {isActive ? <MembersTab orgId={org.id} /> : <SwitchGate org={org} />}
              </TabsContent>
              <TabsContent value="security" className="flex min-w-0 flex-col">
                {isActive ? <SecurityTab orgId={org.id} /> : <SwitchGate org={org} />}
              </TabsContent>
              <TabsContent value="billing" className="flex min-w-0 flex-col">
                {isActive ? <BillingTab /> : <SwitchGate org={org} />}
              </TabsContent>
              <TabsContent value="activity" className="flex min-w-0 flex-col">
                {isActive ? <ActivityTab orgId={org.id} /> : <SwitchGate org={org} />}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function OrgHeader({
  org,
  isActive,
  canWrite,
  onSuspendToggle,
  onDelete,
}: {
  org: Org;
  isActive: boolean;
  canWrite: boolean;
  onSuspendToggle: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("organizations");
  const suspended = org.status === "suspended";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar className="size-14 rounded-xl">
            {org.logo_url ? <AvatarImage src={org.logo_url} alt={org.name} /> : null}
            <AvatarFallback className="rounded-xl bg-primary text-lg font-semibold text-primary-foreground">
              {initials(org.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight">{org.name}</h1>
              <StatusPill status={org.status} dot />
              <Badge variant="muted" className="capitalize">
                {org.plan}
              </Badge>
              {isActive ? <Badge variant="success">{t("tenants.table.current")}</Badge> : null}
            </div>
            <div className="mt-0.5 font-mono text-sm text-muted-foreground">{org.slug}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isActive ? (
            <Button variant="outline" size="sm" onClick={() => void switchToTenant(org.id)}>
              <ArrowLeftRightIcon className="size-4" />
              {t("tenants.table.switch")}
            </Button>
          ) : null}
          {canWrite ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm">
                    {t("detail.actions")}
                    <ChevronDownIcon className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuItem onClick={onSuspendToggle}>
                  {suspended ? <UserCheckIcon /> : <UserXIcon />}
                  {suspended ? t("rowActions.activate") : t("rowActions.suspend")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" disabled={isActive} onClick={onDelete}>
                  <Trash2Icon />
                  {t("rowActions.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {/* Meta strip */}
      <div className="grid grid-cols-2 divide-x divide-y divide-border rounded-xl border sm:grid-cols-4 sm:divide-y-0">
        <MetaCell label={t("preview.plan")}>
          <span className="capitalize">{org.plan}</span>
        </MetaCell>
        <MetaCell label={t("preview.region")}>{org.region || "—"}</MetaCell>
        <MetaCell label={t("preview.members")}>{org.member_count ?? "—"}</MetaCell>
        <MetaCell label={t("detail.orgId")}>
          <CopyId value={org.id} label={t("preview.copyId")} />
        </MetaCell>
      </div>
    </div>
  );
}

function MetaCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 min-w-0 text-sm font-medium">{children}</div>
    </div>
  );
}

// ── Switch gate (non-active org) ──────────────────────────────────────────────

function SwitchGate({ org }: { org: Org }) {
  const { t } = useTranslation("organizations");
  return (
    <div className="rounded-xl border bg-card p-8">
      <EmptyState
        icon={ArrowLeftRightIcon}
        title={t("detail.switchGateTitle")}
        description={t("detail.switchGateDesc", { name: org.name })}
        action={
          <Button size="sm" onClick={() => void switchToTenant(org.id)}>
            <ArrowLeftRightIcon className="size-4" />
            {t("tenants.table.switch")}
          </Button>
        }
      />
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

function OverviewTab({ org, isActive }: { org: Org; isActive: boolean }) {
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

// ── Members (active org) ──────────────────────────────────────────────────────

function MembersTab({ orgId }: { orgId: string }) {
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

// ── Security (active org) ─────────────────────────────────────────────────────

function SecurityTab({ orgId }: { orgId: string }) {
  const { t } = useTranslation("organizations");
  const policyQ = useOrgAuthPolicy(orgId, true);
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
                <InfoRow label={t("detail.otpEmail")}>{method(p.otp_email_enabled)}</InfoRow>
                <InfoRow label={t("detail.otpSms")}>{method(p.otp_sms_enabled)}</InfoRow>
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

// ── Billing (active org) ──────────────────────────────────────────────────────

function BillingTab() {
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

// ── Activity (active org) ─────────────────────────────────────────────────────

function ActivityTab({ orgId }: { orgId: string }) {
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

// ── Small shared bits ─────────────────────────────────────────────────────────

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
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
      )}
      {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
