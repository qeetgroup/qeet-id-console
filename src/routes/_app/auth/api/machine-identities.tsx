import { createFileRoute } from "@tanstack/react-router";

import { MachineIdentitiesPage } from "@/modules/developer/pages";

export const Route = createFileRoute("/_app/auth/api/machine-identities")({
  component: MachineIdentitiesPage,
});
