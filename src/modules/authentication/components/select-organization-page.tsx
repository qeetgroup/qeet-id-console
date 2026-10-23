import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@qeetrix/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { CreateOrgFlow } from "@/modules/onboarding";
import type { PublicSession } from "@/platform/auth/server-session";
import { sessionStore } from "@/platform/auth/session-store";
import { OrganizationSelectionPage } from "./organization-selector";

/**
 * Renders organization selection for a person who belongs to several, or to none yet, with the
 * flow that creates one.
 */
export function SelectOrganizationPage({ session }: { session: PublicSession }) {
  const { t } = useTranslation("auth-flow");
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
