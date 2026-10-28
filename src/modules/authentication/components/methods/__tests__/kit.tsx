// Renders a sign-in page as its tests need it: inside a fresh query client and the shared confirm
// and step-up. The mocks' stand-ins are in stubs.tsx.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";

/** Renders a page inside a fresh query client and the shared confirm and step-up. */
export function renderPage(page: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>{page}</SensitiveActionProvider>
    </QueryClientProvider>,
  );
}
