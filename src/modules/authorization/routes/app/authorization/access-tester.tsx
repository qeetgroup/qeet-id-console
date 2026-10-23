import { createFileRoute } from "@tanstack/react-router";

import { AccessTesterPage } from "@/modules/authorization/pages";

export const Route = createFileRoute("/_app/authorization/access-tester")({
  staticData: { capability: "role.read" },
  component: AccessTesterPage,
});
