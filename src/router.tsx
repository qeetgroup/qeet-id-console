import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

// Initializes i18next at module load, before any component renders.
import i18n from "./i18n";

// Registers the modules' manifests, which the shell's navigation and commands read.
import "./app/register";

import { RootErrorComponent } from "@/platform/errors/error-component";
import { getContext } from "@/platform/query/query-client";
import { registerRouteRequirements } from "@/platform/security/route-capability";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const context = getContext();

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: RootErrorComponent,
    // A language other than the bundled English is fetched before the page hydrates, so the
    // first client render shows the same copy as the server's.
    dehydrate: () => ({ language: i18n.resolvedLanguage ?? "en" }),
    hydrate: async () => {
      await i18n.loadLanguages(i18n.resolvedLanguage ?? i18n.language);
    },
  });

  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient });
  registerRouteRequirements(
    Object.values(router.routesById).map((route) => ({
      fullPath: route.fullPath,
      capability: route.options.staticData?.capability,
    })),
  );

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
