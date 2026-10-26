import { Button, Field } from "@qeetrix/react";
import { CopyButton, OTPInput, QRCode } from "@qeetrix/react/experimental";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { type TotpEnrollment, useConfirmTotpEnrollment } from "@/modules/authentication";
import { errorMessage } from "@/platform/errors/user-message";
import { Failure, Panel } from "../account-parts";

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
  const { t } = useTranslation("account");
  const confirm = useConfirmTotpEnrollment();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null); // the field's
  const [failure, setFailure] = useState<string | null>(null); // the request's

  function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    if (code.length < CODE_LENGTH) return setError(t("security.app.codeRequired"));
    setError(null);
    confirm.mutate(code, {
      onSuccess: (res) => onConfirmed(res.recovery_codes),
      onError: (err) => {
        setCode("");
        setFailure(errorMessage(err));
      },
    });
  }

  return (
    <Panel
      as="li"
      title={enrollment.replacing ? t("security.app.replaceTitle") : t("security.app.setupTitle")}
      description={
        enrollment.replacing
          ? t("security.app.replaceDescription")
          : t("security.app.setupDescription")
      }
    >
      <div className="entry-qr">
        <QRCode value={enrollment.provisioning_url} label={t("security.app.qrLabel")} size={152} />
        <div className="entry-qr-key">
          {t("security.app.keyHint")}
          <code>{groupKey(enrollment.secret)}</code>
          <CopyButton value={enrollment.secret} label={t("security.app.copyKeyLabel")}>
            {t("security.app.copyKey")}
          </CopyButton>
        </div>
      </div>
      <form className="account-panel-form" noValidate onSubmit={submit}>
        <Field label={t("security.app.code")} error={error ?? undefined} invalid={!!error}>
          <OTPInput
            length={CODE_LENGTH}
            groups={[3, 3]}
            autoComplete="one-time-code"
            value={code}
            onValueChange={(value) => {
              setCode(value);
              setError(null);
            }}
          />
        </Field>
        {failure && <Failure>{failure}</Failure>}
        <span className="account-panel-actions">
          <Button size="lg" type="submit" loading={confirm.isPending}>
            {t("security.app.confirm")}
          </Button>
          <Button variant="ghost" size="lg" onClick={onCancel}>
            {t("cancel")}
          </Button>
        </span>
      </form>
    </Panel>
  );
}
