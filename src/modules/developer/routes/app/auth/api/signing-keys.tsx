import { createFileRoute } from "@tanstack/react-router";

import { SigningKeysPage } from "@/modules/developer/pages";

export const Route = createFileRoute("/_app/auth/api/signing-keys")({
  staticData: { capability: "connection.read" },
  component: SigningKeysPage,
});
