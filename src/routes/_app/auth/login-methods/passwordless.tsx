import { createFileRoute } from "@tanstack/react-router";

import { PasswordlessPage } from "@/modules/authentication/pages";

export const Route = createFileRoute("/_app/auth/login-methods/passwordless")({
  component: PasswordlessPage,
});
