import { useNavigate } from "@tanstack/react-router";

import { passkeyErrorMessage, usePasskeySignup } from "../api/passkey-flows";
import { EntryPanel, useEntrySteps } from "./entry-panel";
import { EntryShell } from "./entry-shell";
import { SignupForm } from "./signup-form";
import { useSignup, useStartEmailVerification } from "@/modules/authentication";
import { ApiError } from "@/platform/errors/api-error";
import { ERROR_CODES } from "@/platform/errors/error-codes";
import { errorMessage } from "@/platform/errors/user-message";

/** Renders sign-up by passkey or password, then hands off to email verification. */
export function SignUpPage() {
  const navigate = useNavigate();
  const steps = useEntrySteps();
  const startVerify = useStartEmailVerification();

  // Sign-up leaves a tenant-less, unverified session: send the first code, then hand off to
  // /verify-email, a real route, so a refresh returns there rather than to the dashboard.
  const handoff = (userId: string) => {
    startVerify.mutate(userId);
    navigate({ to: "/verify-email" });
  };

  const signup = useSignup({ onSuccess: (res) => handoff(res.user_id) });
  const passkey = usePasskeySignup({ onSuccess: (res) => handoff(res.user_id) });

  const error = passkey.error ?? signup.error;
  const emailExists = error instanceof ApiError && error.code === ERROR_CODES.EMAIL_EXISTS;

  return (
    <EntryShell panel={<EntryPanel steps={steps.signUp} current={0} />}>
      <SignupForm
        isLoading={signup.isPending}
        isPasskeyLoading={passkey.isPending}
        existingEmail={
          emailExists ? (passkey.variables?.email ?? signup.variables?.email) : undefined
        }
        errorMessage={
          passkey.error
            ? passkeyErrorMessage(passkey.error)
            : signup.error
              ? errorMessage(signup.error)
              : undefined
        }
        onSignup={(values) => {
          passkey.reset();
          signup.mutate({
            email: values.email,
            password: values.password,
            display_name: values.display_name || undefined,
          });
        }}
        onPasskeySignup={(values) => {
          signup.reset();
          passkey.mutate(values);
        }}
      />
    </EntryShell>
  );
}
