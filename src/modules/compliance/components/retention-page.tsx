import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Slider,
} from "@qeetrix/ui";
import { DataState } from "@/platform/components/data-state";
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
  type RetentionPolicy,
  useRetentionPolicy,
  useRetentionPreview,
  useRunRetention,
  useUpdateRetentionPolicy,
} from "../api/retention";

/** Renders the retention policy for deleted people, with preview and run. */
export function RetentionPage() {
  const { t } = useTranslation("compliance");
  const policyQ = useRetentionPolicy();
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader description={t("retention.description")} />
      <DataState
        isLoading={policyQ.isLoading}
        isError={policyQ.isError}
        error={policyQ.error}
        isEmpty={false}
        skeletonRows={3}
      >
        {policyQ.data && <RetentionForm initial={policyQ.data} />}
      </DataState>
    </div>
  );
}

const WINDOW_DAYS = { min: 1, max: 365, fallback: 30 };

const schema = z.object({
  deleted_users_enabled: z.boolean(),
  deleted_users_days: z.number().int().min(WINDOW_DAYS.min).max(WINDOW_DAYS.max),
});

function RetentionForm({ initial }: { initial: RetentionPolicy }) {
  const { t } = useTranslation("compliance");
  const runSensitive = useSensitiveAction();
  const updateM = useUpdateRetentionPolicy();
  const previewM = useRetentionPreview();
  const runM = useRunRetention();
  const form = useAppForm({
    defaultValues: initial,
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      await runSensitive({
        actionLabel: t("retention.deletedUsers.saveAction"),
        run: () => updateM.mutateAsync(value),
      })
        .then((saved) => saved && formApi.reset(saved))
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
        });
    },
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("retention.deletedUsers.title")}</CardTitle>
              <CardDescription>{t("retention.deletedUsers.description")}</CardDescription>
            </div>
            <form.Subscribe selector={(state) => state.values.deleted_users_enabled}>
              {(enabled) => (
                <StatusPill kind={enabled ? "success" : "muted"}>
                  {enabled
                    ? t("retention.deletedUsers.enabled")
                    : t("retention.deletedUsers.disabled")}
                </StatusPill>
              )}
            </form.Subscribe>
          </div>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-6"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
          >
            <form.AppField name="deleted_users_enabled">
              {(field) => (
                <field.SwitchField
                  label={t("retention.deletedUsers.automaticPurge")}
                  description={t("retention.deletedUsers.automaticPurgeHelp")}
                />
              )}
            </form.AppField>
            <form.Field name="deleted_users_days">
              {(field) => (
                <Field>
                  <FieldLabel id="retention-window">
                    {t("retention.deletedUsers.windowLabel", { days: field.state.value })}
                  </FieldLabel>
                  <Slider
                    value={[field.state.value]}
                    onValueChange={(v) =>
                      field.handleChange(Array.isArray(v) ? (v[0] ?? WINDOW_DAYS.fallback) : v)
                    }
                    min={WINDOW_DAYS.min}
                    max={WINDOW_DAYS.max}
                    step={1}
                    aria-labelledby="retention-window"
                  />
                  <FieldDescription>{t("retention.deletedUsers.windowHelp")}</FieldDescription>
                </Field>
              )}
            </form.Field>
            <FormError error={updateM.error} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => previewM.mutate()}
                disabled={previewM.isPending}
              >
                {t("retention.deletedUsers.preview")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  runSensitive({
                    confirm: {
                      title: t("retention.deletedUsers.purgeConfirmTitle"),
                      description: t("retention.deletedUsers.purgeConfirmDescription"),
                      confirmLabel: t("retention.deletedUsers.purgeConfirmLabel"),
                      tone: "destructive",
                    },
                    actionLabel: t("retention.deletedUsers.purgeAction"),
                    run: () => runM.mutateAsync(),
                  }).catch(settleSensitiveAction)
                }
                disabled={runM.isPending}
              >
                {t("retention.deletedUsers.runPurge")}
              </Button>
              <form.AppForm>
                <form.SubmitButton requireChanges pendingLabel={t("retention.deletedUsers.saving")}>
                  {t("retention.deletedUsers.save")}
                </form.SubmitButton>
              </form.AppForm>
            </div>

            {previewM.data && (
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {t("retention.deletedUsers.previewResult", {
                  count: previewM.data.ripe_deleted_users,
                  days: previewM.data.deleted_users_days,
                })}
              </p>
            )}
            {runM.data && (
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {t("retention.deletedUsers.runResult", { count: runM.data.purged })}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("retention.otherDataClasses.title")}</CardTitle>
          <CardDescription>{t("retention.otherDataClasses.description")}</CardDescription>
        </CardHeader>
      </Card>
    </>
  );
}
