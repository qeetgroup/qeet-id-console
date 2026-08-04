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
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SignupForm } from "@/features/auth/components/signup-form";
import { useConfirmEmailVerification, useSignup, useStartEmailVerification } from "@/lib/auth";

export const Route = createFileRoute("/_auth/sign-up")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<{ userId: string; email: string } | null>(null);

  const startVerify = useStartEmailVerification();
  const confirmVerify = useConfirmEmailVerification();

  // On signup the account is created and a tenant-less session is persisted;
  // instead of going straight to the dashboard we send an email OTP and show
  // the verification step. The user reaches the dashboard once verified.
  const signup = useSignup({
    onSuccess: (res) => {
      setPending({ userId: res.user_id, email: res.user.email });
      startVerify.mutate(res.user_id);
    },
  });

  if (pending) {
    return (
      <VerifyEmailStep
        email={pending.email}
        isLoading={confirmVerify.isPending}
        isResending={startVerify.isPending}
        // Surface send failures too — otherwise a failed initial/resend code
        // send leaves the user staring at an OTP box with no code and no error.
        errorMessage={confirmVerify.error?.message ?? startVerify.error?.message}
        onResend={() => startVerify.mutate(pending.userId)}
        onSubmit={(code) =>
          confirmVerify.mutate(
            { userId: pending.userId, code },
            { onSuccess: () => navigate({ to: "/" }) },
          )
        }
      />
    );
  }

  return (
    <SignupForm
      isLoading={signup.isPending}
      errorMessage={signup.error?.message}
      onSignup={(values) => {
        signup.mutate({
          email: values.email,
          password: values.password,
          display_name: values.display_name || undefined,
        });
      }}
    />
  );
}

function VerifyEmailStep({
  email,
  isLoading,
  isResending,
  errorMessage,
  onResend,
  onSubmit,
}: {
  email: string;
  isLoading: boolean;
  isResending: boolean;
  errorMessage?: string;
  onResend: () => void;
  onSubmit: (code: string) => void;
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
            onSubmit={(e) => {
              e.preventDefault();
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
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
