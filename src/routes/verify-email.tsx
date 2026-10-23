import { createFileRoute, redirect } from "@tanstack/react-router";

import { VerifyEmailPage } from "@/modules/authentication/pages";
import { getServerSession } from "@/platform/api/server-proxy";
import { hasVerifiedEmail } from "@/platform/auth/email-verification";

/**
 * Holds a signed-in but unverified account, outside `_auth` (which bounces signed-in users) and
 * `_app` (which it gates). It never sends a code by itself: sign-up sends the first and resends
 * are explicit, so a refresh can't trip the send throttle.
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
