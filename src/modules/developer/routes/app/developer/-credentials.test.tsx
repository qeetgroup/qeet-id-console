// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import type { SensitiveActionOptions } from "@/platform/security/sensitive-action-provider";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "tenant-1" }));
vi.mock("@/platform/components/page-header", () => ({
  PageHeader: ({ actions }: { actions?: ReactNode }) => <div>{actions}</div>,
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
// Records each sensitive action's options while the real provider confirms and runs it.
const sensitive = vi.hoisted(() => ({ calls: [] as SensitiveActionOptions<unknown>[] }));
vi.mock("@/platform/security/sensitive-action-provider", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/platform/security/sensitive-action-provider")>();
  return {
    ...actual,
    useSensitiveAction: () => {
      const run = actual.useSensitiveAction();
      return <T,>(options: SensitiveActionOptions<T>) => {
        sensitive.calls.push(options);
        return run(options);
      };
    },
  };
});

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./credentials";

const CredentialsPage = Route.options.component as () => React.JSX.Element;

const BASE = "/v1/tenants/tenant-1/credentials";
const credential = {
  id: "cred-1",
  subject: "ada@example.com",
  type: "EmploymentCredential",
  issued_at: "2026-09-24T10:15:00Z",
  expires_at: null,
  revoked: false,
};

beforeEach(() => {
  sensitive.calls = [];
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === BASE && !options?.method) return { items: [credential] };
    if (path === BASE && options?.method === "POST") {
      return { credential_id: "cred-2", jwt: "eyJhbGciOiJFUzI1NiJ9.issued.sig" };
    }
    if (path === `${BASE}/cred-1/revoke` && options?.method === "POST") return undefined;
    throw new Error(`Unexpected request ${options?.method ?? "GET"} ${path}`);
  });
});

afterEach(cleanup);

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <CredentialsPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

async function issue() {
  fireEvent.change(screen.getByLabelText(/^Subject/), { target: { value: "ada@example.com" } });
  fireEvent.change(screen.getByLabelText(/^Credential type/), {
    target: { value: "EmploymentCredential" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Issue" }));
  await screen.findByText("eyJhbGciOiJFUzI1NiJ9.issued.sig");
}

describe("Credentials — issuing one", () => {
  it("issues through the sensitive-action path, the submit being the confirmation", async () => {
    renderPage();

    await issue();

    expect(sensitive.calls[0]?.actionLabel).toBe("Issue this credential");
    expect(sensitive.calls[0]?.confirm).toBeUndefined();
  });

  it("shows the signed credential once, with a copy button, until dismissed", async () => {
    renderPage();

    await issue();

    expect(screen.getByText(/won’t be shown again/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /copy/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("eyJhbGciOiJFUzI1NiJ9.issued.sig")).toBeNull();
  });
});

describe("Credentials — revoking one", () => {
  it("revokes only after the admin confirms", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Revoke" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Revoke this credential?");
    expect(api).not.toHaveBeenCalledWith(`${BASE}/cred-1/revoke`, expect.anything());

    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke" }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        `${BASE}/cred-1/revoke`,
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(sensitive.calls[0]?.actionLabel).toBe("Revoke this credential");
  });
});
