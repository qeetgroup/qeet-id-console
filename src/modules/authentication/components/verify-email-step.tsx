import {
  Button,
  Card,
  CardContent,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
} from "@qeetrix/ui";
import { Loader2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * The signup OTP step. Rendered by the standalone `/verify-email` route, which
 * is where an unverified account is held until the code is confirmed — the
 * state used to live in the sign-up component, so a refresh dropped it and let
 * the (already authenticated) user straight into the console.
 */
export function VerifyEmailStep({
  email,
  isLoading,
  isResending,
  errorMessage,
  onResend,
  onSubmit,
  footer,
}: {
  email: string;
  isLoading: boolean;
  isResending: boolean;
  errorMessage?: string;
  onResend: () => void;
  onSubmit: (code: string) => void;
  footer?: React.ReactNode;
}) {
  const [code, setCode] = useState("");
  // Focus the code field on mount (explicit effect instead of autoFocus, which
  // jsx-a11y/no-autofocus flags).
  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    codeRef.current?.focus();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <Card>
        <CardContent className="p-6 md:p-8">
          <form
            aria-busy={isLoading}
            onSubmit={(e) => {
              e.preventDefault();
              if (isLoading) return;
              onSubmit(code.trim());
            }}
          >
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">Verify your email</h1>
                <p className="text-balance text-muted-foreground">
                  We sent a 6-digit code to <span className="font-medium">{email}</span>. Enter it
                  below to finish creating your account.
                </p>
              </div>

              <Field>
                <FieldLabel htmlFor="code">Verification code</FieldLabel>
                <Input
                  ref={codeRef}
                  id="code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
                <FieldDescription>The code expires in 10 minutes.</FieldDescription>
              </Field>

              {errorMessage && (
                <Field>
                  <FieldError>{errorMessage}</FieldError>
                </Field>
              )}

              <Field>
                <Button type="submit" disabled={isLoading || code.trim().length < 6}>
                  {isLoading && <Loader2Icon className="animate-spin" />}
                  {isLoading ? "Verifying…" : "Verify email"}
                </Button>
              </Field>

              <FieldDescription className="text-center">
                Didn&apos;t get it?{" "}
                <button
                  type="button"
                  className="underline underline-offset-4 disabled:opacity-50"
                  onClick={onResend}
                  disabled={isResending}
                >
                  {isResending ? "Resending…" : "Resend code"}
                </button>
              </FieldDescription>

              {footer}
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
