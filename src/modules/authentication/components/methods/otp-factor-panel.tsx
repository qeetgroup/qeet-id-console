import { Button, Field, Radio, RadioGroup } from "@qeetrix/react";
import { OTPInput } from "@qeetrix/react/experimental";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import {
  type OtpChannel,
  type OtpFactor,
  useChallengeOtpFactor,
  useConfirmOtpFactor,
  useEnrollOtpStart,
} from "@/modules/authentication/api/mfa";
import { applyServerErrors, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { Failure, Panel } from "./methods-parts";

const CODE_LENGTH = 6;

/**
 * Adding a phone number or an email address for sign-in codes: where to send them (adding needs a
 * step-up), then the code sent there to confirm it. Given an unconfirmed `factor`, a new code has
 * gone to it and the panel opens on the code.
 */
export function OtpFactorPanel({ factor, onClose }: { factor?: OtpFactor; onClose: () => void }) {
  const [sent, setSent] = useState<{ id: string; to: string } | null>(
    factor ? { id: factor.id, to: factor.destination } : null,
  );
  return sent ? (
    <CodeStep sent={sent} onClose={onClose} />
  ) : (
    <DestinationStep onSent={setSent} onClose={onClose} />
  );
}

function DestinationStep({
  onSent,
  onClose,
}: {
  onSent: (sent: { id: string; to: string }) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("authentication");
  const runSensitive = useSensitiveAction();
  const enroll = useEnrollOtpStart();
  const schema = useMemo(
    () =>
      z
        .object({ channel: z.enum(["sms", "email"]), destination: z.string() })
        .superRefine((value, ctx) => {
          const to = value.destination.trim();
          if (!to) {
            ctx.addIssue({
              code: "custom",
              path: ["destination"],
              message: t(`otp.required.${value.channel}`),
            });
          } else if (value.channel === "email" && !z.email().safeParse(to).success) {
            ctx.addIssue({ code: "custom", path: ["destination"], message: t("otp.invalidEmail") });
          }
        }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { channel: "sms" as OtpChannel, destination: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      const to = value.destination.trim();
      await runSensitive({
        actionLabel: t("otp.add"),
        run: () => enroll.mutateAsync({ channel: value.channel, destination: to }),
      })
        .then((res) => res && onSent({ id: res.factor_id, to }))
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
        });
    },
  });

  return (
    <Panel as="li" title={t("otp.addTitle")} description={t("otp.addDescription")}>
      <form
        className="account-panel-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="channel">
          {(field) => (
            <RadioGroup<OtpChannel>
              label={t("otp.channel")}
              orientation="horizontal"
              value={field.state.value}
              onValueChange={(value) => {
                field.handleChange(value);
                form.setFieldValue("destination", "");
              }}
            >
              <Radio value="sms" label={t("otp.channels.sms")} />
              <Radio value="email" label={t("otp.channels.email")} />
            </RadioGroup>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.values.channel}>
          {(channel) => (
            <form.AppField name="destination">
              {(field) => (
                <field.TextField
                  key={channel}
                  label={t(`otp.labels.${channel}`)}
                  description={channel === "sms" ? t("otp.smsHint") : undefined}
                  placeholder={t(`otp.placeholders.${channel}`)}
                  type={channel === "sms" ? "tel" : "email"}
                  autoComplete={channel === "sms" ? "tel" : "email"}
                />
              )}
            </form.AppField>
          )}
        </form.Subscribe>
        <Failure error={enroll.error} />
        <span className="account-panel-actions">
          <Button size="lg" type="submit" loading={enroll.isPending}>
            {t("otp.send")}
          </Button>
          <Button variant="ghost" size="lg" onClick={onClose}>
            {t("methods.cancel")}
          </Button>
        </span>
      </form>
    </Panel>
  );
}

function CodeStep({ sent, onClose }: { sent: { id: string; to: string }; onClose: () => void }) {
  const { t } = useTranslation("authentication");
  const confirm = useConfirmOtpFactor();
  const challenge = useChallengeOtpFactor();
  const form = useAppForm({
    defaultValues: { code: "" },
    validators: {
      onSubmit: z.object({ code: z.string().length(CODE_LENGTH, t("otp.codeRequired")) }),
    },
    onSubmit: async ({ value, formApi }) => {
      await confirm
        .mutateAsync({ id: sent.id, code: value.code })
        .then(onClose)
        .catch(() => formApi.setFieldValue("code", ""));
    },
  });

  return (
    <Panel
      as="li"
      title={t("otp.codeTitle")}
      description={t("otp.codeDescription", { destination: sent.to })}
    >
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
              <Field label={t("otp.code")} error={error} invalid={!!error}>
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
        <span className="account-panel-links">
          <Button
            variant="ghost"
            size="sm"
            loading={challenge.isPending}
            onClick={() => challenge.mutate(sent.id)}
          >
            {t("otp.resend")}
          </Button>
        </span>
        <Failure error={confirm.error} />
        <span className="account-panel-actions">
          <Button size="lg" type="submit" loading={confirm.isPending}>
            {t("otp.confirm")}
          </Button>
          <Button variant="ghost" size="lg" onClick={onClose}>
            {t("methods.cancel")}
          </Button>
        </span>
      </form>
    </Panel>
  );
}
