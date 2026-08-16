import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

// Side-effect import: initializes the shared i18next instance at module load,
// before any component renders. Static `en` resources keep init synchronous
// and SSR-safe, so the first server render already has translations.
import "./i18n";

import { RootErrorComponent } from "@/platform/errors/error-component";
import { getContext } from "@/platform/query/query-client";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const context = getContext();

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    // Fallback for uncaught render/loader throws — renders user-safe copy
    // instead of a blank page, never leaking raw backend detail.
    defaultErrorComponent: RootErrorComponent,
  });

  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
