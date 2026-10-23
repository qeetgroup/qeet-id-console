import { createFileRoute, redirect } from "@tanstack/react-router";

import { SelectOrganizationPage } from "@/modules/authentication/pages";
import { getServerSession } from "@/platform/api/server-proxy";
import { hasVerifiedEmail } from "@/platform/auth/email-verification";

export const Route = createFileRoute("/select-organization")({
  head: () => ({ meta: [{ title: "Qeet ID - Select an organization" }] }),
  beforeLoad: async ({ context }) => {
    const session = await getServerSession();
    if (!session.isAuthenticated) throw redirect({ to: "/sign-in" });
    if (!(await hasVerifiedEmail(context.queryClient, session.userId)))
      throw redirect({ to: "/verify-email" });
    if (!session.organizationSelectionRequired) throw redirect({ to: "/" });
    return { session };
  },
  component: function SelectOrganizationRoute() {
    return <SelectOrganizationPage session={Route.useRouteContext().session} />;
  },
});
