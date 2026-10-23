import { createFileRoute } from "@tanstack/react-router";

import { PasswordlessPage } from "@/modules/authentication/pages";

export const Route = createFileRoute("/_app/auth/login-methods/passwordless")({
  staticData: { capability: "policy.read" },
  component: PasswordlessPage,
});
