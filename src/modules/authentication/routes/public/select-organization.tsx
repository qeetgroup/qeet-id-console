import { createFileRoute, redirect } from "@tanstack/react-router";

import { SelectOrganizationPage } from "@/modules/authentication/entry-pages";
import { getServerSession } from "@/platform/api/server-proxy";
import { hasVerifiedEmail } from "@/platform/auth/email-verification";
import i18n from "@/i18n";

export const Route = createFileRoute("/select-organization")({
  head: () => ({ meta: [{ title: i18n.t("common:pageTitle.selectOrganization") }] }),
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
