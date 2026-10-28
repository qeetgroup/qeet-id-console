import { Button, Field } from "@qeetrix/react";
import { CopyButton, OTPInput, QRCode } from "@qeetrix/react/experimental";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { type TotpEnrollment, useConfirmTotpEnrollment } from "@/modules/authentication/api/mfa";
import { useAppForm } from "@/platform/forms/app-form";
import { Failure, Panel } from "./methods-parts";

const CODE_LENGTH = 6;

/** A setup key in groups of four, as authenticator apps print it. */
function groupKey(secret: string): string {
  return secret.replace(/\s+/g, "").replace(/(.{4})(?=.)/g, "$1 ");
}

/**
 * Setting up an authenticator app: the QR code beside its setup key (the sign-in setup's
 * `.entry-qr` card), then a code from the app to confirm it, which answers with recovery codes.
 * Its own module, loaded when setup starts, so the QR encoder isn't in the page.
 */
export default function AuthenticatorSetup({
  enrollment,
  onConfirmed,
  onCancel,
}: {
  enrollment: TotpEnrollment;
  onConfirmed: (codes: string[]) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation("authentication");
  const confirm = useConfirmTotpEnrollment();
  const form = useAppForm({
    defaultValues: { code: "" },
    validators: {
      onSubmit: z.object({ code: z.string().length(CODE_LENGTH, t("totp.codeRequired")) }),
    },
    onSubmit: async ({ value, formApi }) => {
      await confirm
        .mutateAsync(value.code)
        .then((res) => onConfirmed(res.recovery_codes))
        .catch(() => formApi.setFieldValue("code", ""));
    },
  });

  return (
    <Panel
      as="li"
      title={enrollment.replacing ? t("totp.replaceTitle") : t("totp.setupTitle")}
      description={enrollment.replacing ? t("totp.replaceDescription") : t("totp.setupDescription")}
    >
      <div className="entry-qr">
        <QRCode value={enrollment.provisioning_url} label={t("totp.qrLabel")} size={152} />
        <div className="entry-qr-key">
          {t("totp.keyHint")}
          <code>{groupKey(enrollment.secret)}</code>
          <CopyButton value={enrollment.secret} label={t("totp.copyKeyLabel")}>
            {t("totp.copyKey")}
          </CopyButton>
        </div>
      </div>
      <form
        className="account-panel-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="code">
          {(field) => {
            const error = field.state.meta.errors
              .map((e) => (typeof e === "string" ? e : e?.message))
              .find(Boolean);
            return (
              <Field label={t("totp.code")} error={error} invalid={!!error}>
                <OTPInput
                  length={CODE_LENGTH}
                  groups={[3, 3]}
                  autoComplete="one-time-code"
                  value={field.state.value}
                  onValueChange={(value) => field.handleChange(value)}
                />
              </Field>
            );
          }}
        </form.Field>
        <Failure error={confirm.error} />
        <span className="account-panel-actions">
          <Button size="lg" type="submit" loading={confirm.isPending}>
            {t("totp.confirm")}
          </Button>
          <Button variant="ghost" size="lg" onClick={onCancel}>
            {t("methods.cancel")}
          </Button>
        </span>
      </form>
    </Panel>
  );
}
