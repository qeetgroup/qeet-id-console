import { Button, formatNumber, VisuallyHidden } from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { formatLocale } from "@/i18n";
import { type AuthPolicy, useAuthPolicy } from "@/modules/authentication/api/auth-policy";
import { useTrustedDeviceSummary } from "@/modules/authentication/api/trusted-devices";
import { applyServerErrors, useAppForm } from "@/platform/forms/app-form";
import { useCapabilities } from "@/platform/security/capability-provider";
import { settleSensitiveAction } from "@/platform/security/sensitive-action-provider";
import { MethodSection } from "./method-section";
import { Detail, EditingDetail, Failure, LoadFailed, Loading } from "./methods-parts";
import { MethodsArea } from "./sign-in-area";
import { useSavePolicy, useSignInMix } from "./use-policy";

// The server refuses a device remembered for under a day or over 90.
const DAYS = { min: 1, max: 90 } as const;

/**
 * Authentication › Sign-in › Passwordless: passkeys, and remembered devices (the second step
 * skipped on a device someone chose to remember). Magic links have their own tab, which owns their
 * switch.
 */
export function PasswordlessPage() {
  const { t } = useTranslation("authentication");
  const policy = useAuthPolicy();
  return (
    <MethodsArea title={t("methods.signIn.title")} description={t("methods.signIn.description")}>
      {policy.isPending ? (
        <Loading rows={3} />
      ) : policy.isError ? (
        <LoadFailed error={policy.error} onRetry={() => void policy.refetch()} />
      ) : (
        <PasswordlessSections policy={policy.data} />
      )}
    </MethodsArea>
  );
}

function PasswordlessSections({ policy }: { policy: AuthPolicy }) {
  const { t } = useTranslation("authentication");
  const access = useCapabilities();
  const canWrite = access.can("policy.write");
  const used = useSignInMix()?.passkey;
  const [editing, setEditing] = useState(false);
  // The count needs connection.read; without it, the row is left out rather than say 0.
  const canCount = access.can("connection.read");
  const devices = useTrustedDeviceSummary(canCount).data;
  const locale = formatLocale();

  return (
    <>
      <MethodSection
        policy={policy}
        method="passkey_enabled"
        canWrite={canWrite}
        title={t("passwordless.passkeys.title")}
        description={
          used === undefined
            ? t("passwordless.passkeys.description")
            : `${t("passwordless.passkeys.description")} ${t("methods.used", { n: used })}`
        }
        turnOff={{
          title: t("passwordless.passkeys.turnOffTitle"),
          description: t("passwordless.passkeys.turnOffDescription"),
        }}
      >
        <p className="account-note">
          {t("passwordless.passkeys.ownBefore")}{" "}
          <Link to="/account/security">{t("passwordless.passkeys.ownLink")}</Link>
          {t("passwordless.passkeys.ownAfter")}
        </p>
      </MethodSection>

      <MethodSection
        policy={policy}
        method="remember_device_enabled"
        canWrite={canWrite}
        title={t("passwordless.remember.title")}
        description={t("passwordless.remember.description")}
        turnOff={{
          title: t("passwordless.remember.turnOffTitle"),
          description: t("passwordless.remember.turnOffDescription"),
        }}
      >
        <dl className="account-details">
          {editing ? (
            <RememberDaysEdit policy={policy} onDone={() => setEditing(false)} />
          ) : (
            <Detail
              label={t("passwordless.remember.days")}
              hint={t("passwordless.remember.daysHint", DAYS)}
              action={
                canWrite && (
                  <Button
                    variant="ghost"
                    aria-label={t("passwordless.remember.editDays")}
                    onClick={() => setEditing(true)}
                  >
                    {t("methods.edit")}
                  </Button>
                )
              }
            >
              {t("passwordless.remember.daysValue", { count: policy.remember_device_days })}
            </Detail>
          )}
          {devices && (
            <Detail
              label={t("passwordless.remember.now")}
              hint={t("passwordless.remember.nowHint")}
            >
              {devices.devices === 0
                ? t("passwordless.remember.none")
                : t("passwordless.remember.nowValue", {
                    count: devices.devices,
                    devices: formatNumber(devices.devices, locale),
                    people: t("passwordless.remember.people", {
                      count: devices.users,
                      n: formatNumber(devices.users, locale),
                    }),
                  })}
            </Detail>
          )}
        </dl>
      </MethodSection>
    </>
  );
}

/** How long a device stays remembered, changed where it's shown. */
function RememberDaysEdit({ policy, onDone }: { policy: AuthPolicy; onDone: () => void }) {
  const { t } = useTranslation("authentication");
  const formId = useId();
  const save = useSavePolicy(policy);
  const message = t("passwordless.remember.daysRange", DAYS);
  const form = useAppForm({
    defaultValues: { remember_device_days: policy.remember_device_days as number | null },
    validators: {
      onSubmit: z.object({
        remember_device_days: z
          .number()
          .int(message)
          .min(DAYS.min, message)
          .max(DAYS.max, message)
          .nullable()
          .refine((value) => value !== null, message),
      }),
    },
    onSubmit: async ({ value, formApi }) => {
      if (value.remember_device_days === policy.remember_device_days) return onDone();
      await save
        .run({ remember_device_days: value.remember_device_days ?? policy.remember_device_days })
        .then(onDone)
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
        });
    },
  });
  return (
    <EditingDetail
      label={t("passwordless.remember.days")}
      buttons={
        <>
          <Button variant="ghost" onClick={onDone}>
            {t("methods.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={save.pending}>
            {t("methods.save")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.AppField name="remember_device_days">
          {(field) => (
            <field.NumberField
              label={<VisuallyHidden>{t("passwordless.remember.days")}</VisuallyHidden>}
              description={t("passwordless.remember.daysUnit", DAYS)}
              min={DAYS.min}
              max={DAYS.max}
              step={1}
              inputMode="numeric"
              autoFocus
            />
          )}
        </form.AppField>
        <Failure error={save.error} />
      </form>
    </EditingDetail>
  );
}
