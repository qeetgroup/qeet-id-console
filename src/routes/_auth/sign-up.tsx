import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { passkeyErrorMessage, usePasskeySignup } from "@/modules/authentication/api/passkey-flows";
import { SignupForm } from "@/modules/authentication/components/signup-form";
import { useSignup, useStartEmailVerification } from "@/modules/authentication";
import { errorMessage } from "@/platform/errors/user-message";

export const Route = createFileRoute("/_auth/sign-up")({
  head: () => ({ meta: [{ title: "Qeet ID – Sign up" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const startVerify = useStartEmailVerification();

  // Sign-up leaves a tenant-less, unverified session: send the first code, then hand off to
  // /verify-email, a real route, so a refresh returns there rather than to the dashboard.
  const handoff = (userId: string) => {
    startVerify.mutate(userId);
    navigate({ to: "/verify-email" });
  };

  const signup = useSignup({ onSuccess: (res) => handoff(res.user_id) });
  const passkey = usePasskeySignup({ onSuccess: (res) => handoff(res.user_id) });

  return (
    <SignupForm
      isLoading={signup.isPending}
      isPasskeyLoading={passkey.isPending}
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
  );
}
