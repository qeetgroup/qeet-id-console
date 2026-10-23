import { createFileRoute } from "@tanstack/react-router";

import { IpAllowlistPage } from "@/modules/security/pages";

export const Route = createFileRoute("/_app/security/threats/ip-allowlist")({
  component: IpAllowlistPage,
});
