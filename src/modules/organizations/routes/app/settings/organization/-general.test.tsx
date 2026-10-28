// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const sensitiveCalls = vi.hoisted(() => [] as { actionLabel?: string; confirm?: unknown }[]);
const access = vi.hoisted(() => ({ write: true }));

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "t-1" }));
vi.mock("@/modules/dashboard", () => ({ PageBreadcrumb: () => null }));
vi.mock("@/modules/billing", () => ({ useSubscription: () => ({ data: undefined }) }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({
    state: "ready",
    can: (capability: string) => access.write || !capability.endsWith(".write"),
  }),
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
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => <a {...props} href={to} />,
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./general";

const GeneralPage = Route.options.component as () => React.JSX.Element;

const tenant = {
  id: "t-1",
  slug: "acme",
  name: "Acme",
  status: "active",
  plan: "pro",
  region: "ap-south-1",
  logo_url: "",
  metadata: { industry: "Software", source: "import" },
  created_at: "2026-09-01T00:00:00Z",
};

beforeEach(() => {
  sensitiveCalls.length = 0;
  access.write = true;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/v1/tenants/t-1")
      return options?.method === "PATCH" ? { ...tenant, ...(options.body as object) } : tenant;
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
        <GeneralPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

const patches = () =>
  vi
    .mocked(api)
    .mock.calls.filter(([, options]) => options?.method === "PATCH")
    .map(([, options]) => options?.body);

describe("Settings › General", () => {
  it("shows the organisation, its profile and its fixed facts, with no status to change", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Acme" })).toBeTruthy();
    expect(screen.getByText("Pro plan")).toBeTruthy();
    expect(screen.getByText("acme")).toBeTruthy();
    expect(screen.getByText("Software")).toBeTruthy();
    // The data region is read-only after creation, and suspending it is never offered.
    expect(screen.queryByRole("button", { name: /data region/i })).toBeNull();
    expect(screen.queryByText(/suspend/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
  });

  it("renames it in place through the sensitive path, sending only the name", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Edit name" }));
    const field = screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement;
    expect(field.value).toBe("Acme");
    fireEvent.change(field, { target: { value: "  Acme Labs " } });
    fireEvent.submit(field.closest("form") as HTMLFormElement);

    await waitFor(() => expect(patches()).toEqual([{ name: "Acme Labs" }]));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(sensitiveCalls).toHaveLength(1);
    expect(sensitiveCalls[0]?.actionLabel).toBe("Change your organisation's details");
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("refuses an empty name before sending anything", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Edit name" }));
    const field = screen.getByRole("textbox", { name: "Name" });
    fireEvent.change(field, { target: { value: "   " } });
    fireEvent.submit(field.closest("form") as HTMLFormElement);
    expect(await screen.findByText("Enter a name.")).toBeTruthy();
    expect(patches()).toEqual([]);
  });

  it("adds a website to the profile, keeping the metadata's other keys", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Add website" }));
    const field = screen.getByRole("textbox", { name: "Website" });
    fireEvent.change(field, { target: { value: "acme.example" } });
    fireEvent.submit(field.closest("form") as HTMLFormElement);

    await waitFor(() =>
      expect(patches()).toEqual([
        {
          metadata: { industry: "Software", source: "import", website: "https://acme.example" },
        },
      ]),
    );
  });

  it("says a website that isn't one is wrong", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Add website" }));
    const field = screen.getByRole("textbox", { name: "Website" });
    fireEvent.change(field, { target: { value: "javascript:alert(1)" } });
    fireEvent.submit(field.closest("form") as HTMLFormElement);
    expect(await screen.findByText("Enter a web address, such as https://qeet.in.")).toBeTruthy();
    expect(patches()).toEqual([]);
  });

  it("clears a profile value by removing its key", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Edit industry" }));
    const field = screen.getByRole("textbox", { name: "Industry" });
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.submit(field.closest("form") as HTMLFormElement);
    await waitFor(() => expect(patches()).toEqual([{ metadata: { source: "import" } }]));
  });

  it("offers no changes without tenant.write", async () => {
    access.write = false;
    renderPage();
    const details = (await screen.findByRole("heading", { name: "Details" })).closest("section");
    expect(within(details as HTMLElement).queryAllByRole("button")).toEqual([]);
    expect(screen.queryByRole("button", { name: /logo/i })).toBeNull();
  });
});
