import { createFileRoute } from "@tanstack/react-router";

import { ForgotPasswordPage } from "@/modules/authentication/pages";

export const Route = createFileRoute("/_auth/forgot-password")({
  component: ForgotPasswordPage,
});
