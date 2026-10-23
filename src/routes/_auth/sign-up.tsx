import { createFileRoute } from "@tanstack/react-router";

import { SignUpPage } from "@/modules/authentication/pages";

export const Route = createFileRoute("/_auth/sign-up")({
  head: () => ({ meta: [{ title: "Qeet ID – Sign up" }] }),
  component: SignUpPage,
});
