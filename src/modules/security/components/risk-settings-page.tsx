import { Card, CardContent, CardDescription, CardHeader, CardTitle, Switch } from "@qeetrix/ui";
import { PlaneIcon, ShieldCheckIcon, SmartphoneIcon } from "@qeetrix/icons";
import type { ComponentType, ReactNode } from "react";
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
import { type RiskSettings, useRiskSettings, useUpdateRiskSettings } from "../api/risk-settings";

const THRESHOLD = { min: 0.1, max: 1, step: 0.05 };
const MIN_TRAVEL_HOURS = 0.5;

/** Renders adaptive sign-in risk: thresholds, forced MFA and the travel and device signals. */
export function RiskSettingsPage() {
  const { t } = useTranslation("security");
  const settingsQ = useRiskSettings();

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader description={t("threats.riskSettings.description")} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheckIcon className="size-4" />
            {t("threats.riskSettings.thresholds.title")}
          </CardTitle>
          <CardDescription>{t("threats.riskSettings.thresholds.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* A failed load shows the error, never a form of made-up settings to save. */}
          <DataState
            isLoading={settingsQ.isLoading}
            isError={settingsQ.isError}
            error={settingsQ.error}
            isEmpty={false}
            skeletonRows={4}
          >
            {settingsQ.data && (
              // A save loads new settings; remounting makes them the form's baseline.
              <RiskSettingsForm key={settingsQ.dataUpdatedAt} settings={settingsQ.data} />
            )}
          </DataState>
        </CardContent>
      </Card>
    </div>
  );
}

function RiskSettingsForm({ settings }: { settings: RiskSettings }) {
  const { t } = useTranslation("security");
  const runSensitive = useSensitiveAction();
  const update = useUpdateRiskSettings();
  const schema = useMemo(() => {
    const threshold = z
      .number(t("threats.riskSettings.validation.threshold"))
      .min(THRESHOLD.min, t("threats.riskSettings.validation.threshold"))
      .max(THRESHOLD.max, t("threats.riskSettings.validation.threshold"));
    return z
      .object({
        medium_threshold: threshold,
        high_threshold: threshold,
        force_mfa_at_level: z.enum(["medium", "high"]),
        impossible_travel_enabled: z.boolean(),
        min_travel_hours: z
          .number(t("threats.riskSettings.validation.travelHours"))
          .min(MIN_TRAVEL_HOURS, t("threats.riskSettings.validation.travelHours")),
        device_reputation_enabled: z.boolean(),
      })
      .refine((v) => v.high_threshold > v.medium_threshold, {
        path: ["high_threshold"],
        message: t("threats.riskSettings.validation.highAboveMedium"),
      });
  }, [t]);
  const form = useAppForm({
    defaultValues: settings as Omit<
      RiskSettings,
      "medium_threshold" | "high_threshold" | "min_travel_hours"
    > & {
      medium_threshold: number | null;
      high_threshold: number | null;
      min_travel_hours: number | null;
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      const body: RiskSettings = {
        ...value,
        medium_threshold: value.medium_threshold ?? settings.medium_threshold,
        high_threshold: value.high_threshold ?? settings.high_threshold,
        min_travel_hours: value.min_travel_hours ?? settings.min_travel_hours,
      };
      await runSensitive({
        actionLabel: t("threats.riskSettings.saveAction").toLowerCase(),
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
      <div className="grid gap-4 sm:grid-cols-2">
        <form.AppField name="medium_threshold">
          {(field) => (
            <field.NumberField
              label={t("threats.riskSettings.thresholds.medium")}
              description={t("threats.riskSettings.thresholds.mediumHelp")}
              {...THRESHOLD}
            />
          )}
        </form.AppField>
        <form.AppField name="high_threshold">
          {(field) => (
            <field.NumberField
              label={t("threats.riskSettings.thresholds.high")}
              description={t("threats.riskSettings.thresholds.highHelp")}
              {...THRESHOLD}
            />
          )}
        </form.AppField>
      </div>

      <div className="max-w-xs">
        <form.AppField name="force_mfa_at_level">
          {(field) => (
            <field.SelectField
              label={t("threats.riskSettings.thresholds.forceAt")}
              description={t("threats.riskSettings.thresholds.forceAtHelp")}
              options={[
                { value: "medium", label: t("threats.riskSettings.thresholds.forceAtMedium") },
                { value: "high", label: t("threats.riskSettings.thresholds.forceAtHigh") },
              ]}
            />
          )}
        </form.AppField>
      </div>

      <div className="flex flex-col gap-4 border-t pt-4">
        <form.Field name="impossible_travel_enabled">
          {(field) => (
            <Signal
              icon={PlaneIcon}
              title={t("threats.riskSettings.impossibleTravel.title")}
              description={t("threats.riskSettings.impossibleTravel.description")}
              checked={field.state.value}
              onCheckedChange={field.handleChange}
            />
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.values.impossible_travel_enabled}>
          {(travelEnabled) =>
            travelEnabled && (
              <div className="max-w-xs pl-6">
                <form.AppField name="min_travel_hours">
                  {(field) => (
                    <field.NumberField
                      label={t("threats.riskSettings.impossibleTravel.minTravelHours")}
                      min={MIN_TRAVEL_HOURS}
                      step={0.5}
                    />
                  )}
                </form.AppField>
              </div>
            )
          }
        </form.Subscribe>
        <form.Field name="device_reputation_enabled">
          {(field) => (
            <Signal
              icon={SmartphoneIcon}
              title={t("threats.riskSettings.deviceReputation.title")}
              description={t("threats.riskSettings.deviceReputation.description")}
              checked={field.state.value}
              onCheckedChange={field.handleChange}
            />
          )}
        </form.Field>
      </div>

      <FormError error={update.error} />
      <div className="flex items-center gap-3">
        <form.AppForm>
          <form.SubmitButton requireChanges>{t("threats.riskSettings.save")}</form.SubmitButton>
        </form.AppForm>
      </div>
    </form>
  );
}

// One risk signal: what it watches for, and its switch.
function Signal({
  icon: Icon,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  icon: ComponentType<{ className?: string }>;
  title: ReactNode;
  description: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={typeof title === "string" ? title : undefined}
      />
    </div>
  );
}
