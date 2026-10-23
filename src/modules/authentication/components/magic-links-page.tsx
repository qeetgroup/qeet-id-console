import { Card, CardContent, CardDescription, CardHeader, CardTitle, Switch } from "@qeetrix/ui";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { DataState } from "@/platform/components/data-state";
import { PageHeader } from "@/platform/components/page-header";
import { StatusPill } from "@/platform/components/status-pill";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import { settleSensitiveAction } from "@/platform/security/sensitive-action-provider";
import { type AuthPolicy, useAuthPolicy } from "../api/auth-policy";
import { useSaveAuthPolicy } from "./use-save-auth-policy";

// The offered lifetimes in minutes, each with its label key; a custom lifetime snaps to an hour.
const TTL_OPTIONS = [
  { minutes: 5, label: "loginMethods.magicLinks.ttl5m" },
  { minutes: 15, label: "loginMethods.magicLinks.ttl15m" },
  { minutes: 30, label: "loginMethods.magicLinks.ttl30m" },
  { minutes: 60, label: "loginMethods.magicLinks.ttl1h" },
  { minutes: 240, label: "loginMethods.magicLinks.ttl4h" },
  { minutes: 1440, label: "loginMethods.magicLinks.ttl24h" },
] as const;
const FALLBACK_TTL = "60";

const schema = z.object({ magic_link_enabled: z.boolean(), magic_link_ttl_minutes: z.string() });

function sliceOf(p: AuthPolicy) {
  const ttl = String(p.magic_link_ttl_minutes);
  return {
    magic_link_enabled: p.magic_link_enabled,
    magic_link_ttl_minutes: TTL_OPTIONS.some((o) => String(o.minutes) === ttl) ? ttl : FALLBACK_TTL,
  };
}

/** Renders the organization's magic-link sign-in: on or off, and how long a link lives. */
export function MagicLinksPage() {
  const { t } = useTranslation("authentication");
  const policyQ = useAuthPolicy();
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader description={t("loginMethods.magicLinks.description")} />
      <DataState
        isLoading={policyQ.isLoading}
        isError={policyQ.isError}
        error={policyQ.error}
        isEmpty={false}
        skeletonRows={2}
      >
        {policyQ.data && <MagicLinkForm policy={policyQ.data} />}
      </DataState>
    </div>
  );
}

function MagicLinkForm({ policy }: { policy: AuthPolicy }) {
  const { t } = useTranslation("authentication");
  const save = useSaveAuthPolicy();
  const form = useAppForm({
    defaultValues: sliceOf(policy),
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      await save
        .run({
          ...policy,
          magic_link_enabled: value.magic_link_enabled,
          magic_link_ttl_minutes: Number(value.magic_link_ttl_minutes),
        })
        .then((saved) => saved && formApi.reset(sliceOf(saved)))
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
        });
    },
  });

  return (
    <form
      className="flex flex-col gap-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe selector={(state) => state.values.magic_link_enabled}>
        {(enabled) => (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t("loginMethods.magicLinks.title")}</CardTitle>
                  <CardDescription>{t("loginMethods.magicLinks.subtitle")}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill kind={enabled ? "success" : "muted"}>
                    {enabled
                      ? t("loginMethods.magicLinks.enabled")
                      : t("loginMethods.magicLinks.disabled")}
                  </StatusPill>
                  <form.Field name="magic_link_enabled">
                    {(field) => (
                      <Switch
                        checked={field.state.value}
                        onCheckedChange={field.handleChange}
                        aria-label={t("loginMethods.magicLinks.title")}
                      />
                    )}
                  </form.Field>
                </div>
              </div>
            </CardHeader>
            <CardContent className="max-w-xs">
              <form.AppField name="magic_link_ttl_minutes">
                {(field) => (
                  <field.SelectField
                    label={t("loginMethods.magicLinks.ttlLabel")}
                    description={t("loginMethods.magicLinks.ttlHelp")}
                    disabled={!enabled}
                    options={TTL_OPTIONS.map((o) => ({
                      value: String(o.minutes),
                      label: t(o.label),
                    }))}
                  />
                )}
              </form.AppField>
            </CardContent>
          </Card>
        )}
      </form.Subscribe>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("loginMethods.magicLinks.howTitle")}</CardTitle>
          <CardDescription>{t("loginMethods.magicLinks.howDescription")}</CardDescription>
        </CardHeader>
      </Card>

      <FormError error={save.error} />
      <div className="flex justify-end gap-2">
        <form.AppForm>
          <form.ResetButton>{t("loginMethods.magicLinks.resetBtn")}</form.ResetButton>
          <form.SubmitButton requireChanges pendingLabel={t("loginMethods.magicLinks.savingBtn")}>
            {t("loginMethods.magicLinks.saveBtn")}
          </form.SubmitButton>
        </form.AppForm>
      </div>
    </form>
  );
}
