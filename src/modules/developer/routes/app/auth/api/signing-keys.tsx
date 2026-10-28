import { createFileRoute } from "@tanstack/react-router";

import { SigningKeysPage } from "@/modules/developer/pages";

// Rebuilt on @qeetrix/react: the page draws its own header. The deployment's key set, read with
// connection.read.
export const Route = createFileRoute("/_app/auth/api/signing-keys")({
  staticData: { capability: "connection.read", pageHeader: true },
  component: SigningKeysPage,
});
