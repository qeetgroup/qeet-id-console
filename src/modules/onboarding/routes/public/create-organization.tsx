import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import i18n from "@/i18n";
import { CreateOrganizationPage, SignedInAs } from "@/modules/onboarding/entry-pages";
import { getServerSession } from "@/platform/api/server-proxy";
import { hasVerifiedEmail } from "@/platform/auth/email-verification";
import { EntryShell } from "@/platform/components/entry-shell";

const field = z.string().optional().catch(undefined);

// Signed in and verified, like choosing an organisation: it opens from the picker, from
// Directory › Organizations and for someone with no organisation yet. `from` names where Cancel
// goes back to; a hosted checkout comes back here with its outcome and, for Razorpay, the signed
// fields the server verifies.
export const Route = createFileRoute("/create-organization")({
  validateSearch: z.object({
    from: z.enum(["select-organization", "organizations"]).optional().catch(undefined),
    checkout: z.enum(["success", "cancelled"]).optional().catch(undefined),
    razorpay_payment_id: field,
    razorpay_payment_link_id: field,
    razorpay_payment_link_reference_id: field,
    razorpay_payment_link_status: field,
    razorpay_signature: field,
  }),
  head: () => ({ meta: [{ title: i18n.t("common:pageTitle.createOrganization") }] }),
  beforeLoad: async ({ context }) => {
    const session = await getServerSession();
    if (!session.isAuthenticated) throw redirect({ to: "/sign-in" });
    if (!(await hasVerifiedEmail(context.queryClient, session.userId)))
      throw redirect({ to: "/verify-email" });
    return { session };
  },
  component: function CreateOrganizationRoute() {
    const { from, ...checkout } = Route.useSearch();
    return (
      <EntryShell note={<SignedInAs />}>
        <CreateOrganizationPage
          session={Route.useRouteContext().session}
          from={from}
          checkout={checkout}
        />
      </EntryShell>
    );
  },
});
