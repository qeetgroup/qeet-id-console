import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldError,
  FieldLabel,
  Input,
  OTPInput,
  Spinner,
} from "@qeetrix/ui";
import { KeyRoundIcon, ShieldCheckIcon } from "@qeetrix/icons";
import { Link } from "@tanstack/react-router";
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

/**
 * Renders the prompt for a `step_up_required` refusal, offering each of the person's factors the
 * organisation counts: passkey, authenticator or recovery code, or an emailed or texted code.
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
    if (!active) return;
    verifyM.mutate(
      { code: value.trim(), kind: active.kind === "otp" ? "otp" : "authenticator" },
      { onSuccess: done },
    );
  }

  const codeLabel =
    active?.kind === "otp"
      ? t("stepUpDialog.codeSentTo", { destination: active.factor.destination })
      : active?.kind === "recovery"
        ? t("stepUpDialog.recoveryCode")
        : t("stepUpDialog.authenticatorCode");
  const busy = verifyM.isPending || sendM.isPending || passkeyM.isPending;
  const failure = verifyM.error ?? sendM.error ?? passkeyM.error;
  const failureText =
    failure instanceof ApiError
      ? errorMessage(failure)
      : failure instanceof Error && failure.name === "NotAllowedError"
        ? t("stepUpDialog.passkeyClosed")
        : failure
          ? t("stepUpDialog.failed")
          : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheckIcon className="size-4 text-muted-foreground" />
            {t("stepUpDialog.title")}
          </DialogTitle>
          <DialogDescription>
            {actionLabel && (
              <>
                <span className="block font-medium text-foreground">{actionLabel}</span>{" "}
              </>
            )}
            {nothing ? t("stepUpDialog.needFactor") : t("stepUpDialog.confirm")}
          </DialogDescription>
        </DialogHeader>

        {options.isLoading && (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        )}

        {nothing && (
          <p className="text-sm text-muted-foreground">
            <Trans
              t={t}
              i18nKey="stepUpDialog.noFactor"
              components={{
                link: (
                  <Link
                    to="/account/security"
                    className="underline"
                    onClick={() => onOpenChange(false)}
                  />
                ),
              }}
            />
          </p>
        )}

        {active && (
          <Field>
            <FieldLabel htmlFor={active.kind === "recovery" ? "step-up-code" : undefined}>
              {codeLabel}
            </FieldLabel>
            <div ref={inputRef}>
              {active.kind === "recovery" ? (
                <Input
                  id="step-up-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  aria-invalid={verifyM.isError}
                />
              ) : (
                <OTPInput
                  value={code}
                  onChange={setCode}
                  onComplete={submit}
                  aria-label={codeLabel}
                  aria-invalid={verifyM.isError}
                />
              )}
            </div>
          </Field>
        )}

        {failureText && <FieldError>{failureText}</FieldError>}

        {opts && (opts.passkey || opts.codeFactors.length > 0 || opts.recoveryCode) && (
          <div className="flex flex-col gap-2">
            {opts.passkey && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => passkeyM.mutate(undefined, { onSuccess: done })}
              >
                {passkeyM.isPending ? (
                  <Spinner size="sm" className="mr-2" />
                ) : (
                  <KeyRoundIcon className="mr-2 size-4" />
                )}
                {t("stepUpDialog.usePasskey")}
              </Button>
            )}
            {opts.codeFactors.map((f) => (
              <Button
                key={f.id}
                variant="outline"
                disabled={busy}
                onClick={() =>
                  sendM.mutate(f.id, {
                    onSuccess: () => {
                      setCode("");
                      verifyM.reset();
                      setMode({ kind: "otp", factor: f });
                    },
                  })
                }
              >
                {t("stepUpDialog.sendCodeTo", { destination: f.destination })}
              </Button>
            ))}
            {opts.recoveryCode && active?.kind !== "recovery" && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setCode("");
                  verifyM.reset();
                  setMode({ kind: "recovery" });
                }}
              >
                {t("stepUpDialog.useARecoveryCodeInstead")}
              </Button>
            )}
          </div>
        )}

        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("actions.cancel")}
          </Button>
          {active && (
            <Button onClick={() => submit(code)} disabled={busy || code.trim().length < 6}>
              {verifyM.isPending && <Spinner size="sm" className="mr-2" />}
              {verifyM.isPending ? t("stepUpDialog.verifying") : t("stepUpDialog.verify")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
