import { createFileRoute } from "@tanstack/react-router";

import { SessionsPage } from "@/modules/security/pages";

// The person's own sessions, kept beside My account › Sessions for now (the user's decision).
// Rebuilt on @qeetrix/react: the page draws its own header.
export const Route = createFileRoute("/_app/security/sessions")({
  component: SessionsPage,
});
