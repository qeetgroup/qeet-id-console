// The User 360 Security and Sessions tabs; the others are in tab-panels-access.tsx and
// tab-panels-identities.tsx.

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { MonitorSmartphoneIcon, ShieldCheckIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import { LinkedPhonesCard, TrustedDevicesCard } from "@/modules/authentication";
import {
  type Anomaly,
  AnomalySeverityBadge,
  AnomalyStatusBadge,
  useAnomalies,
} from "@/modules/security";
import { DataState } from "@/platform/components/data-state";
import { type SecuritySummary, useUserSessions } from "../api/user360";
import { useUserActions } from "../use-user-actions";
import { parseUserAgent } from "../user-agent";
import { InfoRow } from "./user-detail-fields";

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
  const actions = useUserActions();
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
                      disabled={actions.pendingAction.mfaRequired}
                      onCheckedChange={(v) => actions.setMfaRequired({ id: userId }, v)}
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
            error={anomaliesQ.error}
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
                      <AnomalySeverityBadge severity={s.severity} />
                    </TableCell>
                    <TableCell>
                      <AnomalyStatusBadge anomaly={s} />
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

      {/* The member's phones that approve their sign-ins: one can be removed
          without resetting every factor. */}
      <LinkedPhonesCard
        scope={{ kind: "member", userId }}
        canRemove={canWrite}
        className="lg:col-span-2"
      />
    </div>
  );
}
export function SessionsTab({ userId, canWrite }: { userId: string; canWrite: boolean }) {
  const { t } = useTranslation("users");
  const sessionsQ = useUserSessions(userId);
  const actions = useUserActions();
  const items = sessionsQ.data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{t("detail.sessionsTitle")}</CardTitle>
            <CardDescription>{t("detail.sessionsDesc")}</CardDescription>
          </div>
          {canWrite && items.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              disabled={actions.pendingAction.revokeSessions}
              onClick={() => actions.revokeSessions({ id: userId })}
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
      {/* The member's devices remembered in this organisation. */}
      <TrustedDevicesCard scope={{ kind: "member", userId }} canForget={canWrite} />
    </div>
  );
}
