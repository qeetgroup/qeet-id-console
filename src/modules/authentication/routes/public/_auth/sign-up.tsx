import { createFileRoute } from "@tanstack/react-router";

import { SignUpPage } from "@/modules/authentication/entry-pages";
import i18n from "@/i18n";

export const Route = createFileRoute("/_auth/sign-up")({
  head: () => ({ meta: [{ title: i18n.t("common:pageTitle.signUp") }] }),
  component: SignUpPage,
});
