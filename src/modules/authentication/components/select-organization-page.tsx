import { Spinner } from "@qeetrix/react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@qeetrix/ui";
import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { PublicSession } from "@/platform/auth/server-session";
import { sessionStore } from "@/platform/auth/session-store";
import { EntryPanel, useEntrySteps } from "./entry-panel";
import { EntryShell } from "./entry-shell";
import { OrganizationSelectionPage } from "./organization-selector";

// The create flow (plans, logo upload) opens from a button, and the entry routes share this page's
// chunk, so it loads when the dialog opens.
const CreateOrgFlow = lazy(() =>
  import("@/modules/onboarding").then((m) => ({ default: m.CreateOrgFlow })),
);

/**
 * Renders organization selection for a person who belongs to several, or to none yet, with the
 * flow that creates one. The create flow keeps its dialog until onboarding's own redesign.
 */
export function SelectOrganizationPage({ session }: { session: PublicSession }) {
  const { t } = useTranslation("auth-flow");
  const steps = useEntrySteps();
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    sessionStore.hydrate(session);
  }, [session]);
  return (
    <>
      <EntryShell panel={<EntryPanel steps={steps.organisation} current={1} />}>
        <OrganizationSelectionPage key={session.userId} onCreate={() => setCreating(true)} />
      </EntryShell>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90dvh] min-w-0 overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{t("organizationSelection.create")}</DialogTitle>
            <DialogDescription>{t("organizationSelection.createDescription")}</DialogDescription>
          </DialogHeader>
          {creating && (
            <Suspense
              fallback={
                <div className="entry-waiting" role="status">
                  <Spinner size="lg" />
                </div>
              }
            >
              <CreateOrgFlow onCancel={() => setCreating(false)} />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
