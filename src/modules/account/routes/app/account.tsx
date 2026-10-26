import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AccountArea } from "@/modules/account/pages";

export const Route = createFileRoute("/_app/account")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/account" || location.pathname === "/account/") {
      throw redirect({ to: "/account/profile", replace: true });
    }
  },
  // The area draws its own header, so the frame adds no breadcrumb above it.
  staticData: { pageHeader: true },
  component: AccountLayout,
});

/**
 * "My account": one page of the console, open to everyone signed in, with or without an
 * organisation. Its own pages are listed in a column inside it, the chosen one beside them.
 */
function AccountLayout() {
  return (
    <AccountArea>
      <Outlet />
    </AccountArea>
  );
}
