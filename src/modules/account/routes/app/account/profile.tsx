import { createFileRoute } from "@tanstack/react-router";

import { ProfilePage } from "@/modules/account/pages";

export const Route = createFileRoute("/_app/account/profile")({
  component: ProfilePage,
});
