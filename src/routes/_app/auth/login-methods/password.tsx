import { createFileRoute } from "@tanstack/react-router";

import { PasswordPolicyPage } from "@/modules/authentication/pages";

export const Route = createFileRoute("/_app/auth/login-methods/password")({
  component: PasswordPolicyPage,
});
