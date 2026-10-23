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
import type { ParseKeys } from "i18next";
import { DataState } from "@/platform/components/data-state";
import { ShieldIcon, TrashIcon } from "@qeetrix/icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { PageHeader } from "@/platform/components/page-header";
import { StatusPill } from "@/platform/components/status-pill";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import {
  type AddressRefusal,
  type IpAction,
  type IpRule,
  useAddIpRule,
  useAddressRefusals,
  useCheckIp,
  useDeleteIpRule,
  useIpRules,
  useSetIpEnforcement,
} from "../api/ip-allowlist";

/** Renders the address rules: enforcement, the rules, a check and recent refusals. */
export function IpAllowlistPage() {
  const { t } = useTranslation("security");
  const listQ = useIpRules();
  const setEnforce = useSetIpEnforcement();
  const deleteM = useDeleteIpRule();
  const runSensitive = useSensitiveAction();

  const enabled = listQ.data?.enabled ?? false;
  const rules = listQ.data?.items ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        description={t("threats.ipAllowlist.description")}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t("threats.ipAllowlist.enforcement")}
            </span>
            <Switch
              checked={enabled}
              onCheckedChange={(v) =>
                runSensitive({
                  actionLabel: t("threats.ipAllowlist.enforcementAction"),
                  run: () => setEnforce.mutateAsync(v),
                }).catch(settleSensitiveAction)
              }
              disabled={setEnforce.isPending || listQ.isLoading}
            />
          </div>
        }
      />

      {!enabled && rules.length > 0 && (
        <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
          {t("threats.ipAllowlist.disabledBanner")}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("threats.ipAllowlist.coverage.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            {enabled
              ? t("threats.ipAllowlist.coverage.applied")
              : t("threats.ipAllowlist.coverage.off")}
          </p>
          <p>{t("threats.ipAllowlist.coverage.unknown")}</p>
          <p>{t("threats.ipAllowlist.coverage.console")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("threats.ipAllowlist.quickAdd.title")}</CardTitle>
          <CardDescription>{t("threats.ipAllowlist.quickAdd.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <AddRuleForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("threats.ipAllowlist.rules.title")}</CardTitle>
          <CardDescription>
            {t("threats.ipAllowlist.rules.count", { count: rules.length })}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataState
            isLoading={listQ.isLoading}
            isError={listQ.isError}
            error={listQ.error}
            isEmpty={rules.length === 0}
            emptyIcon={ShieldIcon}
            emptyTitle={t("threats.ipAllowlist.rules.empty")}
            skeletonRows={3}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("threats.ipAllowlist.rules.columns.cidr")}</TableHead>
                  <TableHead>{t("threats.ipAllowlist.rules.columns.label")}</TableHead>
                  <TableHead>{t("threats.ipAllowlist.rules.columns.action")}</TableHead>
                  <TableHead>{t("threats.ipAllowlist.rules.columns.added")}</TableHead>
                  <TableHead className="text-right">
                    {t("threats.ipAllowlist.rules.columns.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id} id={`rule-${rule.id}`}>
                    <TableCell className="font-mono text-xs">{rule.cidr}</TableCell>
                    <TableCell>{rule.label || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={rule.action === "deny" ? "destructive" : "default"}>
                        {rule.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <TimeSince value={rule.created_at} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          runSensitive({
                            confirm: {
                              title: t("threats.ipAllowlist.rules.confirmRemoveTitle"),
                              description: t(
                                rule.action === "deny"
                                  ? "threats.ipAllowlist.rules.confirmRemoveDeny"
                                  : "threats.ipAllowlist.rules.confirmRemoveAllow",
                                { cidr: rule.cidr },
                              ),
                              confirmLabel: t("threats.ipAllowlist.rules.confirmRemoveLabel"),
                              tone: "destructive",
                            },
                            actionLabel: t("threats.ipAllowlist.rules.removeAction"),
                            run: () => deleteM.mutateAsync(rule.id),
                          }).catch(settleSensitiveAction)
                        }
                        disabled={deleteM.isPending}
                      >
                        <TrashIcon /> {t("threats.ipAllowlist.rules.remove")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataState>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("threats.ipAllowlist.test.title")}</CardTitle>
          <CardDescription>{t("threats.ipAllowlist.test.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <CheckAddressForm />
        </CardContent>
      </Card>

      <RecentRefusals rules={rules} />
    </div>
  );
}

// The rules' recent refusals from the audit log, each naming the rule
// responsible: a link to it while it exists, its range once removed.
function RecentRefusals({ rules }: { rules: IpRule[] }) {
  const { t } = useTranslation("security");
  const refusalsQ = useAddressRefusals();
  const refusals = refusalsQ.data ?? [];
  const rulesById = new Map(rules.map((r) => [r.id, r]));

  function ruleCell(r: AddressRefusal) {
    if (!r.ruleId) {
      return r.reason === "address_unknown"
        ? t("threats.ipAllowlist.refusals.unknownAddress")
        : t("threats.ipAllowlist.refusals.noRule");
    }
    const rule = rulesById.get(r.ruleId);
    if (!rule) return t("threats.ipAllowlist.refusals.removedRule", { cidr: r.cidr ?? r.ruleId });
    return (
      <a href={`#rule-${rule.id}`} className="font-mono text-xs underline">
        {rule.cidr}
        {rule.label ? ` · ${rule.label}` : ""}
      </a>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("threats.ipAllowlist.refusals.title")}</CardTitle>
        <CardDescription>{t("threats.ipAllowlist.refusals.description")}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <DataState
          isLoading={refusalsQ.isLoading}
          isError={refusalsQ.isError}
          error={refusalsQ.error}
          isEmpty={refusals.length === 0}
          emptyIcon={ShieldIcon}
          emptyTitle={t("threats.ipAllowlist.refusals.empty")}
          skeletonRows={2}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("threats.ipAllowlist.refusals.columns.when")}</TableHead>
                <TableHead>{t("threats.ipAllowlist.refusals.columns.address")}</TableHead>
                <TableHead>{t("threats.ipAllowlist.refusals.columns.method")}</TableHead>
                <TableHead>{t("threats.ipAllowlist.refusals.columns.rule")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {refusals.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    <TimeSince value={r.at} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.address || "—"}</TableCell>
                  <TableCell>
                    {t(`threats.ipAllowlist.refusals.paths.${r.path}`, {
                      defaultValue: r.path || "—",
                    })}
                  </TableCell>
                  <TableCell>{ruleCell(r)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataState>
      </CardContent>
    </Card>
  );
}

/** Renders the inline form that adds an allow or deny rule for an address range. */
function AddRuleForm() {
  const { t } = useTranslation("security");
  const runSensitive = useSensitiveAction();
  const addM = useAddIpRule();
  const schema = useMemo(
    () =>
      z.object({
        cidr: z.string().trim().min(1, t("threats.ipAllowlist.quickAdd.validation.cidr")),
        label: z.string(),
        action: z.enum(["allow", "deny"]),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { cidr: "", label: "", action: "allow" as IpAction },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      await runSensitive({
        actionLabel: t("threats.ipAllowlist.quickAdd.addAction"),
        run: () =>
          addM.mutateAsync({
            cidr: value.cidr.trim(),
            label: value.label.trim(),
            action: value.action,
          }),
      })
        .then((added) => added && formApi.reset())
        .catch((err: unknown) => {
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
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-45 flex-1">
          <form.AppField name="cidr">
            {(field) => (
              <field.TextField
                label={t("threats.ipAllowlist.quickAdd.cidrLabel")}
                placeholder="203.0.113.0/24"
                className="font-mono"
                required
              />
            )}
          </form.AppField>
        </div>
        <div className="min-w-40 flex-1">
          <form.AppField name="label">
            {(field) => (
              <field.TextField
                label={t("threats.ipAllowlist.quickAdd.labelLabel")}
                placeholder={t("ipAllowlistPage.officeNyc")}
              />
            )}
          </form.AppField>
        </div>
        <div className="w-30">
          <form.AppField name="action">
            {(field) => (
              <field.SelectField
                label={t("threats.ipAllowlist.quickAdd.actionLabel")}
                options={[
                  { value: "allow", label: t("threats.ipAllowlist.quickAdd.actionAllow") },
                  { value: "deny", label: t("threats.ipAllowlist.quickAdd.actionDeny") },
                ]}
              />
            )}
          </form.AppField>
        </div>
        <form.AppForm>
          <form.SubmitButton>{t("threats.ipAllowlist.quickAdd.add")}</form.SubmitButton>
        </form.AppForm>
      </div>
      <FormError error={addM.error} />
    </form>
  );
}

// The server's check reasons, shown in the reader's language.
// A server without reason_code sends these reasons instead.
const CHECK_REASONS: Record<string, ParseKeys<"security">> = {
  "ip.allowed": "threats.ipAllowlist.test.reasons.allowed",
  "ip.deny_rule": "threats.ipAllowlist.test.reasons.denyRule",
  "ip.not_in_allow_rules": "threats.ipAllowlist.test.reasons.notAllowed",
  "ip.address_unknown": "threats.ipAllowlist.test.reasons.unknown",
  "ip.enforcement_disabled": "threats.ipAllowlist.test.reasons.enforcementOff",
  allowed: "threats.ipAllowlist.test.reasons.allowed",
  deny_rule: "threats.ipAllowlist.test.reasons.denyRule",
  not_in_allow_rules: "threats.ipAllowlist.test.reasons.notAllowed",
  address_unknown: "threats.ipAllowlist.test.reasons.unknown",
  "enforcement disabled": "threats.ipAllowlist.test.reasons.enforcementOff",
};

/** Renders the check that says whether an address may sign in under the current rules. */
function CheckAddressForm() {
  const { t } = useTranslation("security");
  const checkM = useCheckIp();
  const schema = useMemo(
    () => z.object({ ip: z.string().trim().min(1, t("threats.ipAllowlist.test.validation.ip")) }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { ip: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      await checkM
        .mutateAsync(value.ip.trim())
        .catch((err: unknown) => applyServerErrors(formApi, err));
    },
  });
  const result = checkM.data;
  const reason = result ? CHECK_REASONS[result.reason_code ?? result.reason] : undefined;
  const cidr = result?.reason_params?.cidr;

  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-50 flex-1">
          <form.AppField name="ip">
            {(field) => (
              <field.TextField
                label={t("threats.ipAllowlist.test.ipLabel")}
                description={t("threats.ipAllowlist.test.ipHelp")}
                placeholder="198.51.100.7"
                className="font-mono"
                required
              />
            )}
          </form.AppField>
        </div>
        <form.AppForm>
          <form.SubmitButton variant="outline">
            {t("threats.ipAllowlist.test.check")}
          </form.SubmitButton>
        </form.AppForm>
        {result && (
          <div className="flex items-center gap-2 pb-2">
            <StatusPill kind={result.allowed ? "success" : "danger"}>
              {result.allowed
                ? t("threats.ipAllowlist.test.allowed")
                : t("threats.ipAllowlist.test.blocked")}
            </StatusPill>
            {reason && (
              <span className="text-xs text-muted-foreground">
                {cidr && reason === "threats.ipAllowlist.test.reasons.denyRule"
                  ? t("threats.ipAllowlist.test.reasons.denyRuleNamed", { cidr })
                  : t(reason)}
              </span>
            )}
          </div>
        )}
      </div>
      <FormError error={checkM.error} />
    </form>
  );
}
