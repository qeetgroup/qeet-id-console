// Secondary User 360 tabs: Security, Access, Sessions, Identities, Developer.
// (Overview lives in overview-tab.tsx, Activity in activity-tab.tsx.)

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataState,
  EmptyState,
  JSONTree,
  StatusPill,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import {
  AlertTriangleIcon,
  Building2Icon,
  FingerprintIcon,
  KeyRoundIcon,
  LinkIcon,
  LockIcon,
  MonitorSmartphoneIcon,
  ShieldCheckIcon,
  UsersRoundIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useConfirmDialog } from "@/shared/components/confirm-dialog";
import { type Anomaly, useAnomalies } from "@/modules/security";
import type { AccessSummary, SecuritySummary, UserDetail } from "./api/user360";
import {
  useRevokeAllUserSessions,
  useSetMfaRequired,
  useUserSessions,
  useUserSocialIdentities,
} from "./api/user360";
import { CopyId, InfoRow } from "./user-detail-fields";
import { parseUserAgent } from "./user-agent";

// ── Security tab ─────────────────────────────────────────────────────────────

export function SecurityTab({
  userId,
  security,
  loading,
  canWrite,
}: {
  userId: string;
  security?: SecuritySummary;
  loading: boolean;
  canWrite: boolean;
}) {
  const { t } = useTranslation("users");
  const anomaliesQ = useAnomalies();
  const setMfaRequired = useSetMfaRequired();
  const signals: Anomaly[] = (anomaliesQ.data?.items ?? []).filter((a) => a.user_id === userId);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("detail.authMethodsTitle")}</CardTitle>
          <CardDescription>{t("detail.authMethodsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataState isLoading={loading} isEmpty={false} skeletonRows={6}>
            {security ? (
              <div className="divide-y divide-border/50">
                <InfoRow label={t("detail.password")}>
                  {security.password_set ? (
                    <span className="inline-flex items-center gap-2">
                      {t("detail.enabled")}
                      {security.password_changed_at ? (
                        <span className="text-xs font-normal text-muted-foreground">
                          <TimeSince value={security.password_changed_at} />
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{t("detail.notSet")}</span>
                  )}
                </InfoRow>
                <InfoRow label={t("detail.authenticatorApp")}>
                  {security.totp_enabled ? (
                    <Badge variant="success">{t("detail.enabled")}</Badge>
                  ) : (
                    <span className="text-muted-foreground">{t("detail.notSet")}</span>
                  )}
                </InfoRow>
                <InfoRow label={t("detail.passkeysLabel")}>
                  {security.passkeys > 0 ? (
                    <span className="inline-flex items-center gap-2">
                      {security.passkeys}
                      {security.passkey_last_used_at ? (
                        <span className="text-xs font-normal text-muted-foreground">
                          <TimeSince value={security.passkey_last_used_at} />
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </InfoRow>
                <InfoRow label={t("detail.otpFactors")}>{security.otp_factors}</InfoRow>
                <InfoRow label={t("detail.pushDevices")}>{security.push_devices}</InfoRow>
                <InfoRow label={t("detail.recoveryCodes")}>
                  {security.recovery_codes_remaining}
                </InfoRow>
                <InfoRow label={t("detail.mfaRequired")}>
                  {canWrite ? (
                    <Switch
                      checked={security.mfa_required}
                      disabled={setMfaRequired.isPending}
                      onCheckedChange={(v) => setMfaRequired.mutate({ userId, required: v })}
                    />
                  ) : security.mfa_required ? (
                    <Badge variant="secondary">{t("detail.yes")}</Badge>
                  ) : (
                    <span className="text-muted-foreground">{t("detail.no")}</span>
                  )}
                </InfoRow>
              </div>
            ) : null}
          </DataState>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("detail.securitySignalsTitle")}</CardTitle>
          <CardDescription>{t("detail.securitySignalsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataState
            isLoading={anomaliesQ.isLoading}
            isError={anomaliesQ.isError}
            isEmpty={signals.length === 0}
            emptyIcon={ShieldCheckIcon}
            emptyTitle={t("detail.securitySignalsEmpty")}
            skeletonRows={3}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("detail.signalType")}</TableHead>
                  <TableHead>{t("detail.signalSeverity")}</TableHead>
                  <TableHead>{t("detail.signalStatus")}</TableHead>
                  <TableHead>{t("detail.colWhen")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signals.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.type}</TableCell>
                    <TableCell>
                      <Badge variant={s.severity === "high" ? "destructive" : "outline"}>
                        {s.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{s.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <TimeSince value={s.created_at} />
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

// ── Access tab ───────────────────────────────────────────────────────────────

export function AccessTab({
  access,
  loading,
  permissions,
  permissionsLoading,
}: {
  access?: AccessSummary;
  loading: boolean;
  permissions: string[];
  permissionsLoading: boolean;
}) {
  const { t } = useTranslation("users");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2Icon className="size-4 text-muted-foreground" aria-hidden="true" />
              {t("detail.organization")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataState isLoading={loading} isEmpty={!access?.organization} emptyTitle="—">
              {access?.organization ? (
                <div className="divide-y divide-border/50">
                  <InfoRow label={t("detail.name")}>{access.organization.name}</InfoRow>
                  <InfoRow label={t("detail.slug")}>
                    <span className="font-mono text-xs">{access.organization.slug}</span>
                  </InfoRow>
                  <InfoRow label={t("detail.fieldTenant")}>
                    <CopyId value={access.organization.id} />
                  </InfoRow>
                </div>
              ) : null}
            </DataState>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheckIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              {t("detail.roles")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataState
              isLoading={loading}
              isEmpty={!access?.roles.length}
              emptyIcon={ShieldCheckIcon}
              emptyTitle={t("detail.noRoles")}
              skeletonRows={2}
            >
              <ul className="divide-y divide-border/50">
                {access?.roles.map((r) => (
                  <li key={r.id} className="flex flex-col gap-0.5 px-6 py-2.5">
                    <span className="text-sm font-medium">{r.name}</span>
                    {r.description ? (
                      <span className="text-xs text-muted-foreground">{r.description}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </DataState>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UsersRoundIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              {t("detail.groups")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataState
              isLoading={loading}
              isEmpty={!access?.groups.length}
              emptyIcon={UsersRoundIcon}
              emptyTitle={t("detail.noGroups")}
              skeletonRows={2}
            >
              <ul className="divide-y divide-border/50">
                {access?.groups.map((g) => (
                  <li key={g.id} className="flex flex-col gap-0.5 px-6 py-2.5">
                    <span className="text-sm font-medium">{g.name}</span>
                    {g.description ? (
                      <span className="text-xs text-muted-foreground">{g.description}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </DataState>
          </CardContent>
        </Card>
      </div>

      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="text-base">{t("detail.effectivePermissions")}</CardTitle>
          <CardDescription>
            {t("detail.effectivePermissionsCount", { count: permissions.length })} ·{" "}
            {t("detail.applications")}: {access?.applications_count ?? 0} · {t("detail.policies")}:{" "}
            {access?.policies_count ?? 0}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
          <DataState
            isLoading={permissionsLoading}
            isEmpty={permissions.length === 0}
            emptyIcon={LockIcon}
            emptyTitle={t("detail.noPermissions")}
            skeletonRows={4}
          >
            <div className="flex flex-wrap gap-1.5">
              {permissions.map((p) => (
                <span
                  key={p}
                  className="rounded-md border bg-muted/40 px-2 py-0.5 font-mono text-xs"
                >
                  {p}
                </span>
              ))}
            </div>
          </DataState>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sessions tab ─────────────────────────────────────────────────────────────

export function SessionsTab({ userId, canWrite }: { userId: string; canWrite: boolean }) {
  const { t } = useTranslation("users");
  const sessionsQ = useUserSessions(userId);
  const revokeAll = useRevokeAllUserSessions();
  const [confirmDialog, openConfirm] = useConfirmDialog();
  const items = sessionsQ.data?.items ?? [];

  return (
    <Card>
      {confirmDialog}
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">{t("detail.sessionsTitle")}</CardTitle>
          <CardDescription>{t("detail.sessionsDesc")}</CardDescription>
        </div>
        {canWrite && items.length > 0 ? (
          <Button
            variant="outline"
            size="sm"
            disabled={revokeAll.isPending}
            onClick={() =>
              openConfirm({
                title: t("detail.revokeAllTitle"),
                description: t("detail.revokeAllDescription"),
                variant: "destructive",
                confirmLabel: t("detail.revokeAllConfirm"),
                onConfirm: () => revokeAll.mutate(userId),
              })
            }
          >
            {t("detail.revokeAllBtn")}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        <DataState
          isLoading={sessionsQ.isLoading}
          isError={sessionsQ.isError}
          error={sessionsQ.error}
          isEmpty={items.length === 0}
          emptyIcon={MonitorSmartphoneIcon}
          emptyTitle={t("detail.sessionsEmpty")}
          skeletonRows={3}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("detail.device")}</TableHead>
                <TableHead>{t("detail.colIp")}</TableHead>
                <TableHead>{t("detail.fieldCreated")}</TableHead>
                <TableHead>{t("detail.lastSeen")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((s) => {
                const ua = parseUserAgent(s.user_agent);
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MonitorSmartphoneIcon
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="font-medium" title={s.user_agent ?? undefined}>
                          {ua.label}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {s.ip ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <TimeSince value={s.created_at} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <TimeSince value={s.last_seen_at} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DataState>
      </CardContent>
    </Card>
  );
}

// ── Identities tab ───────────────────────────────────────────────────────────

export function IdentitiesTab({ userId, passwordSet }: { userId: string; passwordSet?: boolean }) {
  const { t } = useTranslation("users");
  const identitiesQ = useUserSocialIdentities(userId);
  const social = identitiesQ.data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("detail.identitiesTitle")}</CardTitle>
        <CardDescription>{t("detail.identitiesDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {passwordSet ? (
          <IdentityRow
            icon={<LockIcon className="size-4" aria-hidden="true" />}
            title={t("detail.password")}
            subtitle={t("detail.passwordIdentity")}
          />
        ) : null}
        <DataState
          isLoading={identitiesQ.isLoading}
          isError={identitiesQ.isError}
          isEmpty={social.length === 0 && !passwordSet}
          emptyIcon={LinkIcon}
          emptyTitle={t("detail.identitiesEmpty")}
          skeletonRows={2}
        >
          {social.map((i) => (
            <IdentityRow
              key={i.id}
              icon={<FingerprintIcon className="size-4" aria-hidden="true" />}
              title={i.provider}
              subtitle={i.email ?? i.subject}
              trailing={
                <span className="text-xs text-muted-foreground">
                  <TimeSince value={i.linked_at} />
                </span>
              }
            />
          ))}
        </DataState>
      </CardContent>
    </Card>
  );
}

function IdentityRow({
  icon,
  title,
  subtitle,
  trailing,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string | null;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium capitalize">{title}</div>
        {subtitle ? <div className="truncate text-xs text-muted-foreground">{subtitle}</div> : null}
      </div>
      {trailing}
    </div>
  );
}

// ── Developer tab ────────────────────────────────────────────────────────────

export function DeveloperTab({ user }: { user: UserDetail }) {
  const { t } = useTranslation("users");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRoundIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            {t("detail.identifiers")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border/50">
            <InfoRow label={t("detail.fieldUserId")}>
              <CopyId value={user.id} truncate={false} />
            </InfoRow>
            <InfoRow label={t("detail.fieldTenant")}>
              <CopyId value={user.tenant_id} truncate={false} />
            </InfoRow>
            <InfoRow label={t("detail.userStatus")}>
              <StatusPill status={user.status} dot />
            </InfoRow>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("detail.metadata")}</CardTitle>
          <CardDescription>{t("detail.metadataDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {user.metadata && Object.keys(user.metadata).length > 0 ? (
            <JSONTree value={user.metadata} rootLabel="metadata" initialOpenDepth={1} />
          ) : (
            <EmptyState icon={AlertTriangleIcon} title={t("detail.metadataEmpty")} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
