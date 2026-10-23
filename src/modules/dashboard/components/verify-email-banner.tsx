import { Button, OTPInput } from "@qeetrix/ui";
import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircleIcon, MailWarningIcon } from "@qeetrix/icons";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { toastError } from "@/platform/errors/error-toast";
import { meKeys, useMe } from "@/platform/auth/session";
import { useConfirmEmailVerification, useStartEmailVerification } from "@/modules/authentication";

/**
 * Renders a sticky banner while the user's email is unverified, catching paths the signup OTP step
 * misses (social sign-in, a skipped step); the server requires a verified email to create an
 * organization. Renders nothing once verified or while the profile loads.
 */
export function VerifyEmailBanner() {
  const { t } = useTranslation("dashboard");
  const meQ = useMe();
  const qc = useQueryClient();
  const start = useStartEmailVerification();
  const confirm = useConfirmEmailVerification();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");

  const me = meQ.data;
  if (!me || me.email_verified_at) return null;

  const resend = () => {
    start.mutate(me.id, {
      onSuccess: () => setOpen(true), // the success toast comes from the mutation's meta
      onError: (err) => toastError(err),
    });
  };

  const submit = (value: string) => {
    confirm.mutate(
      { userId: me.id, code: value },
      {
        onSuccess: () => {
          setOpen(false);
          setCode("");
          void qc.invalidateQueries({ queryKey: meKeys.all });
        },
        onError: (err) => toastError(err), // keeps the specific reason
      },
    );
  };

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 shadow-sm dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <div className="flex items-center gap-2">
        <MailWarningIcon className="size-4 shrink-0" />
        <span>
          <Trans
            t={t}
            shouldUnescape
            i18nKey="verifyEmailBanner.message"
            values={{ email: me.email }}
            components={{ email: <span className="font-medium" /> }}
          />
        </span>
      </div>

      {open ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 6) submit(code);
          }}
        >
          <OTPInput
            value={code}
            onChange={setCode}
            onComplete={submit}
            aria-label={t("verifyEmailBanner.emailVerificationCode")}
          />
          <Button type="submit" size="sm" disabled={confirm.isPending || code.length !== 6}>
            {confirm.isPending && <LoaderCircleIcon className="animate-spin" />}
            {t("verifyEmailBanner.verify")}
          </Button>
        </form>
      ) : (
        <Button size="sm" variant="outline" onClick={resend} disabled={start.isPending}>
          {start.isPending && <LoaderCircleIcon className="animate-spin" />}
          {t("verifyEmailBanner.sendCode")}
        </Button>
      )}
    </div>
  );
}
