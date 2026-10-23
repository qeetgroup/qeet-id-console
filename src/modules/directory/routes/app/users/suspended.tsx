import { createFileRoute } from "@tanstack/react-router";
import { SuspendedPage } from "@/modules/directory/pages";

export const Route = createFileRoute("/_app/users/suspended")({
  staticData: { capability: "user.read" },
  component: SuspendedPage,
});
