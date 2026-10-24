import { createFileRoute } from "@tanstack/react-router";

import { AccountDataPage } from "@/modules/account/pages";

export const Route = createFileRoute("/account/data")({
  component: AccountDataPage,
});
