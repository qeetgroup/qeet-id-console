import { Button, Field, TextField } from "@qeetrix/react";
import { OTPInput } from "@qeetrix/react/experimental";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { useConfirmEmailChange, useStartEmailChange } from "@/modules/authentication";
import { errorMessage } from "@/platform/errors/user-message";
import {
  SensitiveActionCancelled,
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { Failure, OpenDetail, Panel } from "./account-parts";

const CODE_LENGTH = 6;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Changing the sign-in email, opened under its row at full width: the new address first, then the
 * code sent to it. Password resets go to this address, so sending the code needs a step-up. Until
 * the code is confirmed, the old address still signs in.
 */
export function EmailChange({
  current,
  onClose,
  onChanged,
}: {
  current: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation("account");
  const runSensitive = useSensitiveAction();
  const start = useStartEmailChange();
  const confirm = useConfirmEmailChange();
  const [address, setAddress] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null); // the code step shows once it's set
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null); // the field's
  const [failure, setFailure] = useState<string | null>(null); // the request's

  function send(to: string) {
    setError(null);
    setFailure(null);
    runSensitive({ actionLabel: t("profile.email.sendAction"), run: () => start.mutateAsync(to) })
      .then((sent) => {
        if (sent === undefined) return;
        setSentTo(to);
        setCode("");
      })
      .catch((err: unknown) => {
        settleSensitiveAction(err);
        if (!(err instanceof SensitiveActionCancelled)) setFailure(errorMessage(err));
      });
  }

  function submitAddress(event: FormEvent) {
    event.preventDefault();
    const to = address.trim();
    if (!EMAIL.test(to)) return setError(t("profile.email.invalid"));
    if (to.toLowerCase() === current.toLowerCase()) return setError(t("profile.email.same"));
    send(to);
  }

  function submitCode(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    if (code.length < CODE_LENGTH) return setError(t("profile.email.codeRequired"));
    setError(null);
    confirm.mutate(code, {
      onSuccess: onChanged,
      onError: (err) => {
        setCode("");
        setFailure(errorMessage(err));
      },
    });
  }

  const cancel = (
    <Button variant="ghost" size="lg" onClick={onClose}>
      {t("cancel")}
    </Button>
  );

  return (
    <OpenDetail label={t("profile.details.email")}>
      {sentTo ? (
        <Panel
          title={t("profile.email.codeTitle")}
          description={t("profile.email.codeDescription", { email: sentTo })}
        >
          <form className="account-panel-form" noValidate onSubmit={submitCode}>
            <Field label={t("profile.email.code")} error={error ?? undefined} invalid={!!error}>
              <OTPInput
                length={CODE_LENGTH}
                groups={[3, 3]}
                autoComplete="one-time-code"
                autoFocus
                value={code}
                onValueChange={(value) => {
                  setCode(value);
                  setError(null);
                }}
              />
            </Field>
            <span className="account-panel-links">
              <Button
                variant="ghost"
                size="sm"
                disabled={start.isPending}
                onClick={() => send(sentTo)}
              >
                {t("profile.email.resend")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSentTo(null);
                  setError(null);
                  setFailure(null);
                }}
              >
                {t("profile.email.different")}
              </Button>
            </span>
            {failure && <Failure>{failure}</Failure>}
            <span className="account-panel-actions">
              <Button size="lg" type="submit" loading={confirm.isPending}>
                {t("profile.email.confirm")}
              </Button>
              {cancel}
            </span>
          </form>
        </Panel>
      ) : (
        <Panel
          title={t("profile.email.title")}
          description={t("profile.email.description", { email: current })}
        >
          <form className="account-panel-form" noValidate onSubmit={submitAddress}>
            <TextField
              label={t("profile.email.newAddress")}
              type="email"
              autoComplete="email"
              placeholder={t("profile.email.placeholder")}
              autoFocus
              value={address}
              error={error ?? undefined}
              invalid={!!error}
              onChange={(event) => {
                setAddress(event.target.value);
                setError(null);
              }}
            />
            {failure && <Failure>{failure}</Failure>}
            <span className="account-panel-actions">
              <Button size="lg" type="submit" loading={start.isPending}>
                {t("profile.email.send")}
              </Button>
              {cancel}
            </span>
          </form>
        </Panel>
      )}
    </OpenDetail>
  );
}
