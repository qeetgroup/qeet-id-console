import { createFileRoute } from "@tanstack/react-router";

import { DeviceAuthorizationsPage } from "@/modules/security/pages";

export const Route = createFileRoute("/_app/security/device-authorizations")({
  staticData: { capability: "connection.read" },
  component: DeviceAuthorizationsPage,
});
