import { createFileRoute } from "@tanstack/react-router";

import { ScimPage } from "@/modules/authentication/pages";

// SCIM is a connection, so its page sits under Connections (it was a Directories tab at
// /auth/connections/scim, which redirects here). The page itself is rebuilt in its own batch.
export const Route = createFileRoute("/_app/directory/connections/scim")({
  staticData: { capability: "connection.read" },
  component: ScimPage,
});
