import { createFileRoute, redirect } from "@tanstack/react-router";

import { getServerSession } from "@/platform/api/server-proxy";

// An invitation link works signed in too: it joins that account to the organisation.
const OPEN_WHEN_SIGNED_IN = new Set(["/invite/accept"]);

// Every page here renders its own EntryShell, so the layout adds no frame.
export const Route = createFileRoute("/_auth")({
  beforeLoad: async ({ location }) => {
    const session = await getServerSession();
    if (session.isAuthenticated && !OPEN_WHEN_SIGNED_IN.has(location.pathname))
      throw redirect({ to: session.organizationSelectionRequired ? "/select-organization" : "/" });
    return { session };
  },
});
