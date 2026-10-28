import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import type { PublicSession } from "@/platform/auth/server-session";
import { sessionStore } from "@/platform/auth/session-store";
import { EntryPanel, useEntrySteps } from "./entry-panel";
import { EntryShell } from "./entry-shell";
import { OrganizationSelectionPage } from "./organization-selector";

/**
 * Renders organization selection for a person who belongs to several, or to none yet. Creating
 * one opens its own page, and Cancel there comes back here.
 */
export function SelectOrganizationPage({ session }: { session: PublicSession }) {
  const steps = useEntrySteps();
  const navigate = useNavigate();
  useEffect(() => {
    sessionStore.hydrate(session);
  }, [session]);
  return (
    <EntryShell panel={<EntryPanel steps={steps.organisation} current={1} />}>
      <OrganizationSelectionPage
        key={session.userId}
        onCreate={() =>
          void navigate({ to: "/create-organization", search: { from: "select-organization" } })
        }
      />
    </EntryShell>
  );
}
