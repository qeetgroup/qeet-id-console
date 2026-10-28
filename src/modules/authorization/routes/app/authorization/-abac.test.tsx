// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { type ComponentProps, type ReactNode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const sensitiveCalls = vi.hoisted(() => [] as { actionLabel?: string; confirm?: unknown }[]);

vi.mock("@/platform/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/platform/api/client")>()),
  api: vi.fn(),
}));
vi.mock("@/platform/auth/session", () => ({
  useTenantId: () => "t-1",
  useUserId: () => "u-me",
  useSessionId: () => "s-1",
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", mode: "full", can: () => true, canAll: () => true }),
}));
vi.mock("@/platform/security/sensitive-action-provider", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/platform/security/sensitive-action-provider")>();
  return {
    ...actual,
    useSensitiveAction: () => {
      const run = actual.useSensitiveAction();
      return (options: Parameters<typeof run>[0]) => {
        sensitiveCalls.push(options);
        return run(options);
      };
    },
  };
});
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/authorization/abac", searchStr: "", hash: "" }),
  useNavigate: () => vi.fn(),
  useBlocker: () => ({ status: "idle" }),
  Link: ({
    to,
    children,
    ...props
  }: ComponentProps<"a"> & { to: string; children?: ReactNode }) => (
    <a {...props} href={to}>
      {children}
    </a>
  ),
}));
vi.mock("@/modules/billing", () => ({
  useEntitlements: () => ({ data: { features: { abac: true } } }),
  FeatureGate: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
// Monaco needs a real browser; the request under test isn't typed.
vi.mock("@/modules/authorization/components/shared/monaco-panel", () => ({
  MonacoPanel: () => null,
}));

import type { AbacPolicy } from "@/modules/authorization/api/abac";
import { AbacPage } from "@/modules/authorization/pages";
import { setBuilderDoc } from "@/modules/authorization/store/authz-store";
import { emptyPolicyDoc } from "@/modules/authorization/utils/policy-codegen";
import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";

const policy: AbacPolicy = {
  id: "p-1",
  tenant_id: "t-1",
  name: "deny_contractors_prod",
  description: "",
  effect: "deny",
  resource_type: "deployment",
  action: "write",
  condition: {} as never,
  priority: 10,
  enabled: true,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
};

beforeEach(() => {
  sensitiveCalls.length = 0;
  setBuilderDoc(null);
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/tenants/t-1/abac/policies" && method === "GET") return { items: [policy] };
    if (path === "/v1/tenants/t-1/abac/policies" && method === "POST")
      return { ...policy, id: "p-2", ...(options?.body as object) };
    if (path === "/v1/tenants/t-1/abac/policies/p-1" && method === "DELETE") return undefined;
    if (path === "/v1/users") return { items: [] };
    throw new Error(`Unexpected request ${method} ${path}`);
  });
});
afterEach(cleanup);

function Page({ start }: { start?: string }) {
  const [id, setId] = useState(start);
  return <AbacPage policyId={id} onPolicyChange={setId} />;
}

function renderPage(start?: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <Page start={start} />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

function writes() {
  return vi
    .mocked(api)
    .mock.calls.filter(([, options]) => (options?.method ?? "GET") !== "GET")
    .map(([path, options]) => `${options?.method} ${path}`);
}

function lastBody() {
  const call = vi
    .mocked(api)
    .mock.calls.filter(([, o]) => o?.method === "POST")
    .at(-1);
  return call?.[1]?.body as Record<string, unknown>;
}

describe("ABAC › a policy", () => {
  it("draws a policy that stores {} as Always, not as a blank condition", async () => {
    renderPage();
    expect(await screen.findByText("Always")).toBeTruthy();
    expect(screen.queryByText("Pick an attribute")).toBeNull();
  });
});

describe("ABAC › delete a policy", () => {
  it("deletes only after the destructive confirmation, as a sensitive action", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Delete deny_contractors_prod" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Delete this policy?")).toBeTruthy();
    expect(within(dialog).getByText(/deny_contractors_prod.*stops refusing access/)).toBeTruthy();
    expect(writes()).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete policy" }));

    await waitFor(() => expect(writes()).toEqual(["DELETE /v1/tenants/t-1/abac/policies/p-1"]));
    expect(sensitiveCalls[0]?.actionLabel).toBe("Delete this policy");
  });

  it("sends nothing when the confirmation is cancelled", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Delete deny_contractors_prod" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(writes()).toEqual([]);
  });
});

describe("ABAC › new policy", () => {
  it("can't be saved until its condition names an attribute, then creates through the step-up", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /new policy/i }));
    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: "allow_eng" } });
    const create = screen.getByRole("button", { name: "Create policy" });
    expect(create.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Pick an attribute for each condition to save.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/^Attribute/), {
      target: { value: "subject.department" },
    });
    fireEvent.change(screen.getByLabelText(/^Value/), { target: { value: "Engineering" } });
    fireEvent.click(screen.getByRole("button", { name: "Create policy" }));

    await waitFor(() => expect(writes()).toEqual(["POST /v1/tenants/t-1/abac/policies"]));
    expect(lastBody()).toMatchObject({
      name: "allow_eng",
      resource_type: "*",
      action: "*",
      condition: { all: [{ attr: "subject.department", op: "eq", value: "Engineering" }] },
    });
    expect(sensitiveCalls).toHaveLength(1);
    expect(sensitiveCalls[0]?.actionLabel).toBe("Create this policy");
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("opens a template's policy, and saves it once its role block is removed", async () => {
    setBuilderDoc({
      ...emptyPolicyDoc(),
      name: "github_repo_admin",
      requireRole: "maintainer",
      condition: null,
    });
    renderPage("new");
    expect(await screen.findByText("The role block can't be saved yet")).toBeTruthy();
    const create = screen.getByRole("button", { name: "Create policy" });
    expect(create.getAttribute("aria-disabled")).toBe("true");
    const [remove] = screen.getAllByRole("button", { name: "Remove the role block" });
    if (remove) fireEvent.click(remove);
    fireEvent.click(screen.getByRole("button", { name: "Create policy" }));

    await waitFor(() => expect(writes()).toEqual(["POST /v1/tenants/t-1/abac/policies"]));
    expect(lastBody()).toMatchObject({ name: "github_repo_admin", condition: null });
  });
});
