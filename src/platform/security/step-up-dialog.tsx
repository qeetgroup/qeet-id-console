import {
  ChevronRightIcon,
  FingerprintPatternIcon,
  KeyRoundIcon,
  MailIcon,
  MessageSquareIcon,
} from "@qeetrix/icons";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  Field,
  Link,
  Spinner,
  TextField,
} from "@qeetrix/react";
import { Alert, OTPInput } from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { ApiError } from "@/platform/errors/api-error";
import { errorMessage } from "@/platform/errors/user-message";
import {
  type StepUpCodeFactor,
  useStepUpOptions,
  useStepUpPasskey,
  useStepUpSendCode,
  useStepUpVerify,
} from "@/platform/security/step-up";

import "./step-up-dialog.css";

type StepUpDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void; // after a successful step-up: retry the gated action here
  // The action's label, e.g. "Delete user", shown as given on its own line: spliced into a
  // sentence it would force one case and word order on every language.
  actionLabel?: string;
  allowedMethods?: string[] | null; // factor types the organisation counts; null = all
};

// How the code being typed is checked: an authenticator-app code, a recovery
// code, or a code sent to an email or SMS factor.
type CodeMode =
  | { kind: "authenticator" }
  | { kind: "recovery" }
  | { kind: "otp"; factor: StepUpCodeFactor };

const CODE_LENGTH = 6;
const FORM_ID = "step-up-form";

/**
 * Renders the prompt for a `step_up_required` refusal, offering each of the person's factors the
 * organisation counts: a code in six slots (authenticator app, or one sent by email or SMS), a
 * recovery code in its place, a passkey, and sending a code, as the sign-in's second step does.
 * Calls onVerified once confirmed; someone with no counted factor is told what to set up.
 */
export function StepUpDialog({
  open,
  onOpenChange,
  onVerified,
  actionLabel,
  allowedMethods = null,
}: StepUpDialogProps) {
  const { t } = useTranslation("common");
  const options = useStepUpOptions(open, allowedMethods);
  const verifyM = useStepUpVerify();
  const sendM = useStepUpSendCode();
  const passkeyM = useStepUpPasskey();
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<CodeMode | null>(null);

  const opts = options.data;
  // Default to the authenticator app when the person has one.
  const active: CodeMode | null = mode ?? (opts?.authenticator ? { kind: "authenticator" } : null);
  const nothing =
    opts &&
    !opts.passkey &&
    !opts.authenticator &&
    !opts.recoveryCode &&
    opts.codeFactors.length === 0;

  // Focuses the first code input when one appears, in place of autoFocus. Keyed on the mode's
  // kind: `active` is a new object each render while the default applies, and would re-focus.
  const inputRef = useRef<HTMLDivElement>(null);
  const activeKind = active?.kind;
  useEffect(() => {
    if (!open || !activeKind) return;
    const id = setTimeout(() => {
      inputRef.current?.querySelector<HTMLInputElement>("input:not([disabled])")?.focus();
    }, 50);
    return () => clearTimeout(id);
  }, [open, activeKind]);

  const busy = verifyM.isPending || sendM.isPending || passkeyM.isPending;

  function reset() {
    setCode("");
    setMode(null);
    verifyM.reset();
    sendM.reset();
    passkeyM.reset();
  }

  function done() {
    reset();
    onOpenChange(false);
    onVerified();
  }

  function submit(value: string) {
    if (!active || busy) return;
    verifyM.mutate(
      { code: value.trim(), kind: active.kind === "otp" ? "otp" : "authenticator" },
      // A refused code clears the field, so the next attempt starts empty.
      { onSuccess: done, onError: () => setCode("") },
    );
  }

  function chooseCode(next: CodeMode) {
    setCode("");
    verifyM.reset();
    setMode(next);
  }

  const codeLabel =
    active?.kind === "otp"
      ? t("stepUpDialog.codeSentTo", { destination: active.factor.destination })
      : active?.kind === "recovery"
        ? t("stepUpDialog.recoveryCode")
        : t("stepUpDialog.authenticatorCode");
  const failure = verifyM.error ?? sendM.error ?? passkeyM.error;
  const failureText =
    failure instanceof ApiError
      ? errorMessage(failure)
      : failure instanceof Error && failure.name === "NotAllowedError"
        ? t("stepUpDialog.passkeyClosed")
        : failure
          ? t("stepUpDialog.failed")
          : null;
  // A refused code is the code field's error; a failed send or passkey prompt is the dialog's.
  const codeError = verifyM.error && failureText ? failureText : undefined;
  const otherError = !verifyM.error && failureText ? failureText : undefined;
  const ready = active?.kind === "recovery" ? code.trim().length >= 6 : code.length === CODE_LENGTH;
  // Between the app and a recovery code, both made by the authenticator set-up.
  const other: CodeMode | null =
    active?.kind === "recovery"
      ? opts?.authenticator
        ? { kind: "authenticator" }
        : null
      : opts?.recoveryCode
        ? { kind: "recovery" }
        : null;
  const sending = (id: string) => sendM.isPending && sendM.variables === id;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent
        title={t("stepUpDialog.title")}
        description={
          <>
            {actionLabel && (
              <>
                <span className="step-up-action">{actionLabel}</span>{" "}
              </>
            )}
            {nothing ? t("stepUpDialog.needFactor") : t("stepUpDialog.confirm")}
          </>
        }
        size="md"
      >
        <DialogBody>
          <div className="step-up">
            {options.isLoading && (
              <div className="step-up-loading">
                <Spinner />
              </div>
            )}

            {nothing && (
              <p className="step-up-note">
                <Trans
                  t={t}
                  i18nKey="stepUpDialog.noFactor"
                  components={{
                    link: (
                      <Link
                        render={<RouterLink to="/account/security" />}
                        onClick={() => onOpenChange(false)}
                      />
                    ),
                  }}
                />
              </p>
            )}

            {otherError && <Alert tone="danger" title={otherError} announce="urgent" />}

            {active && (
              <form
                id={FORM_ID}
                className="step-up-code"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  if (ready) submit(code);
                }}
              >
                <div ref={inputRef}>
                  {active.kind === "recovery" ? (
                    <TextField
                      label={codeLabel}
                      icon={KeyRoundIcon}
                      placeholder={t("stepUpDialog.recoveryPlaceholder")}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      value={code}
                      onValueChange={setCode}
                      error={codeError}
                    />
                  ) : (
                    <Field label={codeLabel} error={codeError}>
                      <OTPInput
                        length={CODE_LENGTH}
                        groups={[3, 3]}
                        autoComplete="one-time-code"
                        value={code}
                        onValueChange={setCode}
                        onValueComplete={submit}
                      />
                    </Field>
                  )}
                </div>
                {other && (
                  <button
                    type="button"
                    className="step-up-text-button"
                    disabled={busy}
                    onClick={() => chooseCode(other)}
                  >
                    {other.kind === "recovery"
                      ? t("stepUpDialog.useARecoveryCodeInstead")
                      : t("stepUpDialog.useAuthenticatorInstead")}
                  </button>
                )}
              </form>
            )}

            {opts && (opts.passkey || opts.codeFactors.length > 0) && (
              <>
                {active && (
                  <div className="step-up-or" aria-hidden="true">
                    {t("stepUpDialog.or")}
                  </div>
                )}
                {opts.passkey && (
                  <Button
                    variant="soft"
                    size="lg"
                    fullWidth
                    icon={FingerprintPatternIcon}
                    loading={passkeyM.isPending}
                    disabled={busy}
                    onClick={() => passkeyM.mutate(undefined, { onSuccess: done })}
                  >
                    {t("stepUpDialog.usePasskey")}
                  </Button>
                )}
                {opts.codeFactors.length > 0 && (
                  <ul className="step-up-options" aria-label={t("stepUpDialog.otherWays")}>
                    {opts.codeFactors.map((f) => {
                      const Icon = f.channel === "sms" ? MessageSquareIcon : MailIcon;
                      return (
                        <li key={f.id}>
                          <button
                            type="button"
                            className="step-up-option"
                            disabled={busy}
                            aria-busy={sending(f.id) || undefined}
                            onClick={() =>
                              sendM.mutate(f.id, {
                                onSuccess: () => chooseCode({ kind: "otp", factor: f }),
                              })
                            }
                          >
                            <Icon shape="sharp" size={20} aria-hidden="true" />
                            <span className="step-up-option-text">
                              {t("stepUpDialog.sendCodeTo", { destination: f.destination })}
                            </span>
                            {sending(f.id) ? (
                              <Spinner size="sm" decorative />
                            ) : (
                              <ChevronRightIcon shape="sharp" size={16} aria-hidden="true" />
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}

            {opts && !active && opts.recoveryCode && (
              <button
                type="button"
                className="step-up-text-button"
                disabled={busy}
                onClick={() => chooseCode({ kind: "recovery" })}
              >
                {t("stepUpDialog.useARecoveryCodeInstead")}
              </button>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("actions.cancel")}
          </Button>
          {active && (
            <Button
              type="submit"
              form={FORM_ID}
              loading={verifyM.isPending}
              disabled={busy || !ready}
            >
              {verifyM.isPending ? t("stepUpDialog.verifying") : t("stepUpDialog.verify")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
