import { Button, Field, Radio, RadioGroup, TextField } from "@qeetrix/react";
import { OTPInput } from "@qeetrix/react/experimental";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  type OtpChannel,
  type OtpFactor,
  useChallengeOtpFactor,
  useConfirmOtpFactor,
  useEnrollOtpStart,
} from "@/modules/authentication";
import { errorMessage } from "@/platform/errors/user-message";
import {
  SensitiveActionCancelled,
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { Failure, Panel } from "../account-parts";

const CODE_LENGTH = 6;

/**
 * Adding a phone number or an email address for sign-in codes: where to send them, then the code
 * sent there to confirm it. Adding one needs a step-up. Given an unconfirmed `factor`, a new code
 * goes to it and the panel opens on the code.
 */
export function OtpFactorPanel({ factor, onClose }: { factor?: OtpFactor; onClose: () => void }) {
  const { t } = useTranslation("account");
  const runSensitive = useSensitiveAction();
  const enroll = useEnrollOtpStart();
  const confirm = useConfirmOtpFactor();
  const challenge = useChallengeOtpFactor();
  const [channel, setChannel] = useState<OtpChannel>(factor?.channel ?? "sms");
  const [destination, setDestination] = useState("");
  const [sent, setSent] = useState<{ id: string; to: string } | null>(
    factor ? { id: factor.id, to: factor.destination } : null,
  );
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null); // the field's
  const [failure, setFailure] = useState<string | null>(null); // the request's

  function submitDestination(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    const to = destination.trim();
    if (!to) return setError(t(`security.otp.${channel}Required`));
    setError(null);
    runSensitive({
      actionLabel: t("security.otp.action"),
      run: () => enroll.mutateAsync({ channel, destination: to }),
    })
      .then((res) => res && setSent({ id: res.factor_id, to }))
      .catch((err: unknown) => {
        settleSensitiveAction(err);
        if (!(err instanceof SensitiveActionCancelled)) setFailure(errorMessage(err));
      });
  }

  function submitCode(event: FormEvent) {
    event.preventDefault();
    if (!sent) return;
    setFailure(null);
    if (code.length < CODE_LENGTH) return setError(t("security.otp.codeRequired"));
    setError(null);
    confirm.mutate(
      { id: sent.id, code },
      {
        onSuccess: onClose,
        onError: (err) => {
          setCode("");
          setFailure(errorMessage(err));
        },
      },
    );
  }

  const cancel = (
    <Button variant="ghost" size="lg" onClick={onClose}>
      {t("cancel")}
    </Button>
  );

  if (sent) {
    return (
      <Panel
        as="li"
        title={t("security.otp.codeTitle")}
        description={t("security.otp.codeDescription", { destination: sent.to })}
      >
        <form className="account-panel-form" noValidate onSubmit={submitCode}>
          <Field label={t("security.otp.code")} error={error ?? undefined} invalid={!!error}>
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
          <span className="account-panel-links">
            <Button
              variant="ghost"
              size="sm"
              loading={challenge.isPending}
              onClick={() => challenge.mutate(sent.id)}
            >
              {t("security.otp.resend")}
            </Button>
          </span>
          {failure && <Failure>{failure}</Failure>}
          <span className="account-panel-actions">
            <Button size="lg" type="submit" loading={confirm.isPending}>
              {t("security.otp.confirm")}
            </Button>
            {cancel}
          </span>
        </form>
      </Panel>
    );
  }

  return (
    <Panel as="li" title={t("security.otp.title")} description={t("security.otp.description")}>
      <form className="account-panel-form" noValidate onSubmit={submitDestination}>
        <RadioGroup<OtpChannel>
          label={t("security.otp.channel")}
          orientation="horizontal"
          value={channel}
          onValueChange={(value) => {
            setChannel(value);
            setDestination("");
            setError(null);
          }}
        >
          <Radio value="sms" label={t("security.otp.sms")} />
          <Radio value="email" label={t("security.otp.email")} />
        </RadioGroup>
        <TextField
          key={channel}
          label={t(`security.otp.${channel}Label`)}
          type={channel === "sms" ? "tel" : "email"}
          autoComplete={channel === "sms" ? "tel" : "email"}
          placeholder={t(`security.otp.${channel}Placeholder`)}
          description={channel === "sms" ? t("security.otp.smsHint") : undefined}
          value={destination}
          error={error ?? undefined}
          invalid={!!error}
          onChange={(event) => {
            setDestination(event.target.value);
            setError(null);
          }}
        />
        {failure && <Failure>{failure}</Failure>}
        <span className="account-panel-actions">
          <Button size="lg" type="submit" loading={enroll.isPending}>
            {t("security.otp.send")}
          </Button>
          {cancel}
        </span>
      </form>
    </Panel>
  );
}
