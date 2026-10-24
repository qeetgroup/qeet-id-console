import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { useConfirmEmailVerification, useStartEmailVerification } from "@/modules/authentication";
import { VerifyEmailStep } from "./verify-email-step";
import type { PublicSession } from "@/platform/auth/server-session";
import { meKeys, useLogout, useMe } from "@/platform/auth/session";
import { sessionStore } from "@/platform/auth/session-store";
import { errorMessage } from "@/platform/errors/user-message";

/** Renders email verification for a signed-in, unverified account. */
export function VerifyEmailPage({ session }: { session: PublicSession }) {
  const { t } = useTranslation("auth-flow");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useMe();
  const logout = useLogout();
  const startVerify = useStartEmailVerification();
  const confirmVerify = useConfirmEmailVerification();
  // A reload starts with an empty browser session, which would leave the profile unread; this page
  // sits outside the shell that otherwise hands the server's session over.
  useEffect(() => {
    sessionStore.hydrate(session);
  }, [session]);

  // From the server session, so the code can be checked before the profile has loaded.
  const userId = session.userId;
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
                // The guard reads the profile; without invalidating, the redirect below
                // would bounce straight back here on cached data.
                await qc.invalidateQueries({ queryKey: meKeys.user(userId) });
                navigate({ to: "/" });
              },
            },
          );
        }}
        // The only other way out of this page. Without it an unverified user
        // who can't reach their inbox is stuck with no way to switch accounts.
        footer={
          <p className="text-center text-sm text-muted-foreground">
            {t("verifyEmail.wrongAccount")}{" "}
            <button
              type="button"
              className="underline underline-offset-4 disabled:opacity-50"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              {t("verifyEmail.signOut")}
            </button>
          </p>
        }
      />
    </div>
  );
}
