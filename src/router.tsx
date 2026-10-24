import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { getGlobalStartContext } from "@tanstack/react-start";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

// Before any schema parses: no eval, which the Content-Security-Policy forbids.
import "@/platform/config/zod";

// Initializes i18next at module load, before any component renders.
import i18n from "./i18n";

// Registers the modules' manifests, which the shell's navigation and commands read.
import "./app/register";

import { RootErrorComponent } from "@/platform/errors/error-component";
import { getContext } from "@/platform/query/query-client";
import { registerRouteRequirements } from "@/platform/security/route-capability";
import { startClientTelemetry } from "@/platform/telemetry/client-reporter";
import { routeTree } from "./routeTree.gen";

function requestNonce(): string | undefined {
  try {
    return getGlobalStartContext()?.nonce;
  } catch {
    return undefined; // outside a request, e.g. in tests
  }
}

export function getRouter() {
  const context = getContext();

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: RootErrorComponent,
    // The request's CSP nonce (src/start.ts), put on every script the router renders; in the
    // browser the router reads it back from the page.
    ssr: { nonce: requestNonce() },
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
  // Started before hydration, so a hydration failure is reported too. Only the deepest route's
  // template (`/users/$userId`) is named, never the URL.
  startClientTelemetry(() => router.state.matches.at(-1)?.fullPath);

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
