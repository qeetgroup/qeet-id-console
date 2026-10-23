import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@qeetrix/ui";
import { GaugeIcon, LoaderCircleIcon, RotateCcwIcon } from "@qeetrix/icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { DataState } from "@/platform/components/data-state";
import { PageHeader } from "@/platform/components/page-header";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import {
  type TenantLimits,
  useRateLimits,
  useResetRateLimits,
  useUpdateRateLimits,
} from "../api/rate-limits";

// The three buckets, each with its copy.
const BUCKETS = [
  { key: "tenant", copy: "tenant" },
  { key: "user", copy: "user" },
  { key: "api_key", copy: "apiKey" },
] as const;

/** Renders the organization's rate limits per organization, person and API key. */
export function RateLimitsPage() {
  const { t } = useTranslation("security");
  const runSensitive = useSensitiveAction();
  const limitsQ = useRateLimits();
  const reset = useResetRateLimits();

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader description={t("threats.rateLimits.description")} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <GaugeIcon className="size-4" />
              {t("threats.rateLimits.card.title")}
            </CardTitle>
            <CardDescription>{t("threats.rateLimits.card.description")}</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={reset.isPending}
            onClick={() =>
              runSensitive({
                confirm: {
                  title: t("threats.rateLimits.card.resetConfirmTitle"),
                  confirmLabel: t("threats.rateLimits.card.resetConfirmLabel"),
                  tone: "destructive",
                },
                actionLabel: t("threats.rateLimits.card.resetAction").toLowerCase(),
                run: () => reset.mutateAsync(),
              }).catch(settleSensitiveAction)
            }
          >
            {reset.isPending ? <LoaderCircleIcon className="animate-spin" /> : <RotateCcwIcon />}
            {t("threats.rateLimits.card.resetToDefaults")}
          </Button>
        </CardHeader>
        <CardContent>
          {/* A failed load shows the error, never a form of made-up limits to save. */}
          <DataState
            isLoading={limitsQ.isLoading}
            isError={limitsQ.isError}
            error={limitsQ.error}
            isEmpty={false}
            skeletonRows={3}
          >
            {limitsQ.data && (
              // A save or reset loads new limits; remounting makes them the form's baseline.
              <RateLimitsForm key={limitsQ.dataUpdatedAt} limits={limitsQ.data} />
            )}
          </DataState>
        </CardContent>
      </Card>
    </div>
  );
}

function RateLimitsForm({ limits }: { limits: TenantLimits }) {
  const { t } = useTranslation("security");
  const runSensitive = useSensitiveAction();
  const update = useUpdateRateLimits();
  const schema = useMemo(() => {
    const count = z
      .number(t("threats.rateLimits.validation.positive"))
      .int(t("threats.rateLimits.validation.positive"))
      .min(1, t("threats.rateLimits.validation.positive"));
    const bucket = z.object({ rate: count, capacity: count });
    return z.object({ tenant: bucket, user: bucket, api_key: bucket });
  }, [t]);
  const form = useAppForm({
    defaultValues: limits as {
      [K in keyof TenantLimits]: { rate: number | null; capacity: number | null };
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      const body: TenantLimits = {
        tenant: { rate: value.tenant.rate ?? 1, capacity: value.tenant.capacity ?? 1 },
        user: { rate: value.user.rate ?? 1, capacity: value.user.capacity ?? 1 },
        api_key: { rate: value.api_key.rate ?? 1, capacity: value.api_key.capacity ?? 1 },
      };
      await runSensitive({
        actionLabel: t("threats.rateLimits.card.saveAction").toLowerCase(),
        run: () => update.mutateAsync(body),
      }).catch((err: unknown) => {
        applyServerErrors(formApi, err);
        settleSensitiveAction(err);
      });
    },
  });

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      {BUCKETS.map((b) => (
        <div
          key={b.key}
          className="grid gap-3 border-b pb-4 last:border-0 last:pb-0 sm:grid-cols-[1fr_120px_120px] sm:items-end"
        >
          <div>
            <p className="text-sm font-medium">{t(`threats.rateLimits.rows.${b.copy}.label`)}</p>
            <p className="text-sm text-muted-foreground">
              {t(`threats.rateLimits.rows.${b.copy}.description`)}
            </p>
          </div>
          <form.AppField name={`${b.key}.rate`}>
            {(field) => (
              <field.NumberField label={t("threats.rateLimits.card.rateLabel")} min={1} step={1} />
            )}
          </form.AppField>
          <form.AppField name={`${b.key}.capacity`}>
            {(field) => (
              <field.NumberField label={t("threats.rateLimits.card.burstLabel")} min={1} step={1} />
            )}
          </form.AppField>
        </div>
      ))}
      <FormError error={update.error} />
      <div className="flex items-center gap-3 pt-2">
        <form.AppForm>
          <form.SubmitButton requireChanges>{t("threats.rateLimits.card.save")}</form.SubmitButton>
        </form.AppForm>
      </div>
    </form>
  );
}
