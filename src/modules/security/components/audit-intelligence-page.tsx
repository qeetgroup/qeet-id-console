import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { DataState } from "@/platform/components/data-state";
import { Link } from "@tanstack/react-router";
import {
  BrainCircuitIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "@qeetrix/icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { PageHeader } from "@/platform/components/page-header";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import {
  type AnomalyReason,
  useAuditAnomalies,
  type AuditAnomalySettings,
  useAuditAnomalySettings,
  useAuditAnomalySummary,
  useResolveAuditAnomaly,
  useUpdateAuditAnomalySettings,
  useVerifyAuditChain,
} from "../api/audit-anomalies";

function scoreBadge(score: number) {
  if (score >= 0.85) return <Badge variant="destructive">{score.toFixed(2)}</Badge>;
  if (score >= 0.7) return <Badge variant="secondary">{score.toFixed(2)}</Badge>;
  return <Badge variant="outline">{score.toFixed(2)}</Badge>;
}

/** Renders audit intelligence: anomalies in the audit trail, detection settings and chain checks. */
export function AuditIntelligencePage() {
  const { t } = useTranslation("security");
  const [status, setStatus] = useState<"open" | "resolved">("open");
  const anomaliesQ = useAuditAnomalies(status);
  const summaryQ = useAuditAnomalySummary();
  const resolve = useResolveAuditAnomaly();
  const items = anomaliesQ.data?.items ?? [];
  const sm = summaryQ.data;

  // Reason labels use translation lookups keyed by the AnomalyReason value
  const getReasonLabel = (r: AnomalyReason): string => t(`auditIntelligence.reasonLabels.${r}`);

  const summary = [
    {
      key: "open",
      value: sm?.open ?? 0,
      icon: <TriangleAlertIcon className="size-4" />,
    },
    {
      key: "highScore",
      value: sm?.high_score_open ?? 0,
      icon: <SparklesIcon className="size-4" />,
    },
    {
      key: "resolved7d",
      value: sm?.resolved_7d ?? 0,
      icon: <ShieldCheckIcon className="size-4" />,
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        description={t("auditIntelligence.description")}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              anomaliesQ.refetch();
              summaryQ.refetch();
            }}
            disabled={anomaliesQ.isFetching}
          >
            <RefreshCwIcon className={anomaliesQ.isFetching ? "animate-spin" : ""} />
            {t("auditIntelligence.refresh")}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {summary.map((s) => (
          <Card key={s.key}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>{t(`auditIntelligence.summary.${s.key}`)}</CardDescription>
              <span className="text-muted-foreground">{s.icon}</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>{t("auditIntelligence.anomalies.title")}</CardTitle>
            <CardDescription>{t("auditIntelligence.anomalies.description")}</CardDescription>
          </div>
          <Select value={status} onValueChange={(v) => v && setStatus(v as "open" | "resolved")}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">{t("auditIntelligence.anomalies.statusOpen")}</SelectItem>
              <SelectItem value="resolved">
                {t("auditIntelligence.anomalies.statusResolved")}
              </SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <DataState
            isLoading={anomaliesQ.isLoading}
            isError={anomaliesQ.isError}
            error={anomaliesQ.error}
            isEmpty={items.length === 0}
            emptyIcon={BrainCircuitIcon}
            emptyTitle={
              status === "open"
                ? t("auditIntelligence.anomalies.emptyOpen")
                : t("auditIntelligence.anomalies.emptyResolved")
            }
            skeletonRows={3}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("auditIntelligence.anomalies.columns.action")}</TableHead>
                  <TableHead>{t("auditIntelligence.anomalies.columns.actor")}</TableHead>
                  <TableHead>{t("auditIntelligence.anomalies.columns.reason")}</TableHead>
                  <TableHead>{t("auditIntelligence.anomalies.columns.score")}</TableHead>
                  <TableHead>{t("auditIntelligence.anomalies.columns.when")}</TableHead>
                  <TableHead className="text-right">
                    {t("auditIntelligence.anomalies.columns.rowAction")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.action}</TableCell>
                    <TableCell>
                      {a.actor_user_id ? (
                        <Link
                          to="/security/audit-logs"
                          search={{ actor_user_id: a.actor_user_id }}
                          className="underline"
                        >
                          {a.actor_email ?? a.actor_user_id}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.reasons.map((r) => getReasonLabel(r)).join(", ")}
                    </TableCell>
                    <TableCell>{scoreBadge(a.score)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <TimeSince value={a.event_at} />
                    </TableCell>
                    <TableCell className="text-right">
                      {a.status === "resolved" ? (
                        <span className="text-xs text-muted-foreground">
                          {t("auditIntelligence.anomalies.resolved")}
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={resolve.isPending}
                          onClick={() => resolve.mutate(a.id)}
                        >
                          {t("auditIntelligence.anomalies.resolve")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataState>
        </CardContent>
      </Card>

      <SettingsCard />
      <VerifyCard />
    </div>
  );
}

/** Renders the detection settings: on or off, the score threshold and the cold-start guard. */
function SettingsCard() {
  const { t } = useTranslation("security");
  const settingsQ = useAuditAnomalySettings();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("auditIntelligence.settings.title")}</CardTitle>
        <CardDescription>{t("auditIntelligence.settings.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* A failed load shows the error, never a form of made-up settings to save. */}
        <DataState
          isLoading={settingsQ.isLoading}
          isError={settingsQ.isError}
          error={settingsQ.error}
          isEmpty={false}
          skeletonRows={1}
        >
          {settingsQ.data && (
            <SettingsForm key={settingsQ.dataUpdatedAt} settings={settingsQ.data} />
          )}
        </DataState>
      </CardContent>
    </Card>
  );
}

function SettingsForm({ settings }: { settings: AuditAnomalySettings }) {
  const { t } = useTranslation("security");
  const runSensitive = useSensitiveAction();
  const updateM = useUpdateAuditAnomalySettings();
  const schema = useMemo(
    () =>
      z.object({
        enabled: z.boolean(),
        score_threshold: z
          .number(t("auditIntelligence.settings.validation.threshold"))
          .min(0, t("auditIntelligence.settings.validation.threshold"))
          .max(1, t("auditIntelligence.settings.validation.threshold")),
        min_baseline_events: z
          .number(t("auditIntelligence.settings.validation.events"))
          .int(t("auditIntelligence.settings.validation.events"))
          .min(0, t("auditIntelligence.settings.validation.events")),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: {
      enabled: settings.enabled,
      score_threshold: settings.score_threshold as number | null,
      min_baseline_events: settings.min_baseline_events as number | null,
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      await runSensitive({
        actionLabel: t("auditIntelligence.settings.saveAction").toLowerCase(),
        run: () =>
          updateM.mutateAsync({
            enabled: value.enabled,
            score_threshold: value.score_threshold ?? settings.score_threshold,
            min_baseline_events: value.min_baseline_events ?? settings.min_baseline_events,
          }),
      }).catch((err: unknown) => {
        applyServerErrors(formApi, err);
        settleSensitiveAction(err);
      });
    },
  });

  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="enabled">
        {(field) => <field.SwitchField label={t("auditIntelligence.settings.enabled")} />}
      </form.AppField>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-48">
          <form.AppField name="score_threshold">
            {(field) => (
              <field.NumberField
                label={t("auditIntelligence.settings.scoreThreshold")}
                min={0}
                max={1}
                step={0.05}
              />
            )}
          </form.AppField>
        </div>
        <div className="sm:w-48">
          <form.AppField name="min_baseline_events">
            {(field) => (
              <field.NumberField
                label={t("auditIntelligence.settings.coldStartGuard")}
                min={0}
                step={1}
              />
            )}
          </form.AppField>
        </div>
        <form.AppForm>
          <form.SubmitButton requireChanges>
            {t("auditIntelligence.settings.save")}
          </form.SubmitButton>
        </form.AppForm>
      </div>
      <FormError error={updateM.error} />
    </form>
  );
}

// The server's codes for a broken chain, and the sentences a server without them sends instead.
const BROKEN_REASONS: Record<string, string> = {
  "audit.chain_prev_hash_mismatch": "auditIntelligence.verify.brokenLink",
  "audit.chain_row_hash_mismatch": "auditIntelligence.verify.brokenRow",
  "prev_hash does not match preceding row_hash": "auditIntelligence.verify.brokenLink",
  "row_hash does not match recomputed hash": "auditIntelligence.verify.brokenRow",
};

/** Renders the chain check: walks the hash-chained audit log and reports the first break. */
function VerifyCard() {
  const { t } = useTranslation("security");
  const verifyM = useVerifyAuditChain();
  const result = verifyM.data;
  const reason = result
    ? BROKEN_REASONS[result.reason_code ?? result.broken_reason ?? ""]
    : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("auditIntelligence.verify.title")}</CardTitle>
        <CardDescription>{t("auditIntelligence.verify.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3" aria-live="polite">
        <div>
          <Button variant="outline" disabled={verifyM.isPending} onClick={() => verifyM.mutate()}>
            {verifyM.isPending
              ? t("auditIntelligence.verify.verifying")
              : t("auditIntelligence.verify.verify")}
          </Button>
        </div>
        {result &&
          (result.ok ? (
            <p className="text-sm text-muted-foreground">
              {t("auditIntelligence.verify.intact", { count: result.rows_checked })}
            </p>
          ) : (
            <p className="text-sm text-destructive">
              {t("auditIntelligence.verify.broken", { id: result.broken_at_id })}
              {reason && <> {t(reason)}</>}
            </p>
          ))}
        <FormError error={verifyM.error} />
      </CardContent>
    </Card>
  );
}
