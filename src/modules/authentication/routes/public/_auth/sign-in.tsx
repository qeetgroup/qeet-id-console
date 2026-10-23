import { createFileRoute } from "@tanstack/react-router";

import { SignInPage } from "@/modules/authentication/pages";
import i18n from "@/i18n";

export const Route = createFileRoute("/_auth/sign-in")({
  head: () => ({ meta: [{ title: i18n.t("common:pageTitle.signIn") }] }),
  component: SignInPage,
});
