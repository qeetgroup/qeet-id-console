import { createFileRoute } from "@tanstack/react-router";

import { UserSessionsPage } from "@/modules/users/pages";

// Rebuilt on @qeetrix/react: the page draws its own header. A kept duplicate of My account ›
// Sessions (the user's decision, 2026-10-26: removed later).
export const Route = createFileRoute("/_app/users/sessions")({
  staticData: { capability: "user.read", pageHeader: true },
  component: UserSessionsPage,
});
