import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { useConfirmEmailVerification, useStartEmailVerification } from "@/modules/authentication";
import { VerifyEmailStep } from "@/modules/authentication/components/verify-email-step";
import { getServerSession } from "@/platform/api/server-proxy";
import { hasVerifiedEmail } from "@/platform/auth/email-verification";
import { useLogout, useMe } from "@/platform/auth/session";
import { errorMessage } from "@/platform/errors/user-message";

/**
 * Standalone holding page for an authenticated-but-unverified account.
 *
 * Deliberately NOT under `_auth` (that layout bounces authenticated users) and
 * NOT under `_app` (that layout is what we're gating). A fresh signup holds a
 * real tenant-less session, so it is authenticated the whole time it sits here.
 *
 * This route never auto-sends a code: sign-up sends the first one before
 * redirecting here, and resends are explicit. Otherwise every refresh would
 * fire another email and trip the send throttle.
 */
export const Route = createFileRoute("/verify-email")({
  head: () => ({ meta: [{ title: "Qeet ID – Verify your email" }] }),
  beforeLoad: async ({ context }) => {
    const session = await getServerSession();
    if (!session.isAuthenticated) throw redirect({ to: "/sign-in" });
    // Already verified: nothing to do here, and leaving the page reachable
    // would strand a verified user on a dead-end form.
    if (await hasVerifiedEmail(context.queryClient, session.userId)) {
      throw redirect({ to: "/" });
    }
    return { session };
  },
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useMe();
  const logout = useLogout();
  const startVerify = useStartEmailVerification();
  const confirmVerify = useConfirmEmailVerification();

  const userId = me.data?.id;
  const verificationError = confirmVerify.error ?? startVerify.error;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <VerifyEmailStep
        email={me.data?.email ?? ""}
        isLoading={confirmVerify.isPending}
        isResending={startVerify.isPending}
        errorMessage={verificationError ? errorMessage(verificationError) : undefined}
        onResend={() => userId && startVerify.mutate(userId)}
        onSubmit={(code) => {
          if (!userId) return;
          confirmVerify.mutate(
            { userId, code },
            {
              onSuccess: async () => {
                // The guard reads `["me", userId]`; without invalidating, the
                // redirect below would bounce straight back here on cached data.
                await qc.invalidateQueries({ queryKey: ["me", userId] });
                navigate({ to: "/" });
              },
            },
          );
        }}
        // The only other way out of this page. Without it an unverified user
        // who can't reach their inbox is stuck with no way to switch accounts.
        footer={
          <p className="text-center text-sm text-muted-foreground">
            Wrong account?{" "}
            <button
              type="button"
              className="underline underline-offset-4 disabled:opacity-50"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              Sign out
            </button>
          </p>
        }
      />
    </div>
  );
}
