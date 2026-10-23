import { createFileRoute } from "@tanstack/react-router";

import { SignInPage } from "@/modules/authentication/pages";

export const Route = createFileRoute("/_auth/sign-in")({
  head: () => ({ meta: [{ title: "Qeet ID – Sign in" }] }),
  component: SignInPage,
});
