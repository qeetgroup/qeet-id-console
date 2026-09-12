import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@qeetrix/ui";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { OrganizationSelectionPage } from "@/modules/authentication/components/organization-selector";
import { CreateOrgFlow } from "@/modules/onboarding/create-org-flow";
import { getServerSession } from "@/platform/api/server-proxy";
import { hasVerifiedEmail } from "@/platform/auth/email-verification";
import { sessionStore } from "@/platform/auth/session-store";

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
  component: SelectOrganizationPage,
});

function SelectOrganizationPage() {
  const { t } = useTranslation("auth-flow");
  const { session } = Route.useRouteContext();
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    sessionStore.hydrate(session);
  }, [session]);
  return (
    <>
      <OrganizationSelectionPage key={session.userId} onCreate={() => setCreating(true)} />
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90dvh] min-w-0 overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{t("organizationSelection.create")}</DialogTitle>
            <DialogDescription>{t("organizationSelection.createDescription")}</DialogDescription>
          </DialogHeader>
          {creating && <CreateOrgFlow onCancel={() => setCreating(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
