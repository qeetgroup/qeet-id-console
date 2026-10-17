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
  /** Called after a successful step-up — retry the gated action here. */
  onVerified: () => void;
  /** What the user is about to do, e.g. "regenerate your recovery codes". */
  actionLabel?: string;
  /** The factor types the organisation counts (from the refusal); null when every one does. */
  allowedMethods?: string[] | null;
};

// How the code being typed is checked: an authenticator-app code, a recovery
// code, or a code sent to an email or SMS factor.
type CodeMode =
  | { kind: "authenticator" }
  | { kind: "recovery" }
  | { kind: "otp"; factor: StepUpCodeFactor };

/**
 * StepUpDialog meets a `step_up_required` (403) gate with any of the person's
 * factors that the organisation counts: a passkey, an authenticator-app or
 * recovery code, or a code sent to an email or SMS factor. Once confirmed it
 * calls onVerified so the action can be sent again. Someone with no factor that
 * counts is told what to set up.
 */
export function StepUpDialog({
  open,
  onOpenChange,
  onVerified,
  actionLabel,
  allowedMethods = null,
}: StepUpDialogProps) {
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

  // Focus the first code input when one appears (replaces autoFocus, which
  // jsx-a11y/no-autofocus flags).
  const inputRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !active) return;
    const id = setTimeout(() => {
      inputRef.current?.querySelector<HTMLInputElement>("input:not([disabled])")?.focus();
    }, 50);
    return () => clearTimeout(id);
  }, [open, active?.kind]);

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
      ? `Code sent to ${active.factor.destination}`
      : active?.kind === "recovery"
        ? "Recovery code"
        : "Code from your authenticator app";
  const busy = verifyM.isPending || sendM.isPending || passkeyM.isPending;
  const failure = verifyM.error ?? sendM.error ?? passkeyM.error;
  const failureText =
    failure instanceof ApiError
      ? errorMessage(failure)
      : failure instanceof Error && failure.name === "NotAllowedError"
        ? "The passkey prompt was closed. Try again."
        : failure
          ? "That didn't work. Try again."
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
            Confirm it&apos;s you
          </DialogTitle>
          <DialogDescription>
            {actionLabel ? `To ${actionLabel}, ` : "This action needs a fresh check: "}
            {nothing
              ? "you need a second factor first."
              : "confirm with one of your second factors."}
          </DialogDescription>
        </DialogHeader>

        {options.isLoading && (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        )}

        {nothing && (
          <p className="text-sm text-muted-foreground">
            None of your factors can confirm this. Set up a passkey or an authenticator app in{" "}
            <Link to="/account/security" className="underline" onClick={() => onOpenChange(false)}>
              account security
            </Link>
            , then try again.
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
                Use a passkey
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
                Send a code to {f.destination}
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
                Use a recovery code instead
              </Button>
            )}
          </div>
        )}

        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          {active && (
            <Button onClick={() => submit(code)} disabled={busy || code.trim().length < 6}>
              {verifyM.isPending && <Spinner size="sm" className="mr-2" />}
              {verifyM.isPending ? "Verifying…" : "Verify"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
