// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/platform/api/client")>()),
  api: vi.fn(),
}));
vi.mock("@/platform/auth/session", () => ({
  useTenantId: () => "t1",
  useUserId: () => "u-me",
  useSessionId: () => "s1",
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", mode: "full", can: () => true, canAll: () => true }),
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/developer/webhooks", searchStr: "", hash: "" }),
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
  Link: ({
    to,
    params,
    children,
    ...props
  }: ComponentProps<"a"> & { to: string; params?: { id: string }; children?: ReactNode }) => (
    <a {...props} href={to.replace("$id", params?.id ?? "")}>
      {children}
    </a>
  ),
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { WebhookPage } from "../components/webhooks/webhook-page";
import { WebhooksPage } from "../components/webhooks/webhooks-page";

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const OFF = {
  id: "w-off",
  tenant_id: "t1",
  url: "https://staging-api.qeet.in/notify/v1/webhooks/qeet-id",
  events: ["session.revoked", "user.created"],
  disabled_at: ago(2),
  disabled_reason: "failing",
  failing_since: ago(5),
  created_at: ago(120),
};
const FAILING = {
  id: "w-failing",
  tenant_id: "t1",
  url: "https://notify.qeet.in/v1/sources/qeet-id/webhooks",
  events: ["user.created"],
  failing_since: ago(1),
  created_at: ago(90),
};
const DELIVERIES = [
  {
    id: "d-held-0001",
    event_type: "session.revoked",
    attempt: 6,
    error: "dial tcp: lookup staging-api.qeet.in: no such host",
    payload: '{"type":"session.revoked"}',
    next_attempt_at: ago(1),
    created_at: ago(2.5),
  },
  {
    id: "d-dead-0002",
    event_type: "session.revoked",
    attempt: 60,
    error: "dial tcp: lookup staging-api.qeet.in: no such host",
    payload: "{}",
    dead_at: ago(3),
    next_attempt_at: ago(3),
    created_at: ago(5),
  },
  {
    id: "d-done-0003",
    event_type: "user.created",
    attempt: 1,
    status_code: 200,
    payload: "{}",
    response_body: "ok",
    delivered_at: ago(6),
    next_attempt_at: ago(6),
    created_at: ago(6),
  },
];

let calls: { method: string; path: string; body?: unknown }[];
beforeEach(() => {
  calls = [];
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(
    async (path: string, options?: { method?: string; body?: unknown }) => {
      const method = options?.method ?? "GET";
      calls.push({ method, path, body: options?.body });
      if (method === "GET") {
        if (path === "/v1/tenants/t1/webhooks") return { items: [OFF, FAILING] };
        if (path === "/v1/webhooks/w-off") return OFF;
        if (path === "/v1/webhooks/w-off/deliveries") return { items: DELIVERIES };
        if (path === "/v1/tenants/t1/webhooks/events")
          return {
            items: [
              { name: "user.created", description: "" },
              { name: "user.deleted", description: "" },
              { name: "session.revoked", description: "" },
            ],
          };
      }
      if (method === "POST" && path === "/v1/webhooks")
        return { ...FAILING, id: "w-new", failing_since: null, secret: "whsec-shown-once" };
      if (method !== "GET") return { message: "ok" };
      throw new Error(`Unexpected ${method} ${path}`);
    },
  );
});
afterEach(cleanup);

function renderWith(node: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>{node}</SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

describe("Webhooks list", () => {
  it("names each endpoint by its host, with its state and why", async () => {
    renderWith(<WebhooksPage filters={{}} onFiltersChange={vi.fn()} />);
    const table = within(await screen.findByRole("table", { name: "Webhooks" }));
    expect(await table.findByText("staging-api.qeet.in")).toBeTruthy();
    expect(table.getByText("Turned off")).toBeTruthy();
    expect(table.getByText(/After 3 days of failures/)).toBeTruthy();
    expect(table.getByText("Failing")).toBeTruthy();
    expect(table.getByText(/turns off after/)).toBeTruthy();
    expect(table.getByRole("link", { name: /staging-api\.qeet\.in/ }).getAttribute("href")).toBe(
      "/developer/webhooks/w-off",
    );
  });

  it("disables only after saying new events aren't sent and waiting ones are held", async () => {
    renderWith(<WebhooksPage filters={{}} onFiltersChange={vi.fn()} />);
    await screen.findByText("notify.qeet.in");
    fireEvent.click(screen.getByRole("button", { name: /Actions for .*notify\.qeet\.in/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Disable" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/aren’t sent, now or later/)).toBeTruthy();
    expect(within(dialog).getByText(/held and go out when you enable it/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Disable webhook" }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === "DELETE" && c.path === "/v1/webhooks/w-failing")).toBe(
        true,
      ),
    );
  });

  it("creates a webhook for the chosen events and shows its signing secret once", async () => {
    renderWith(<WebhooksPage filters={{}} onFiltersChange={vi.fn()} />);
    await screen.findByText("notify.qeet.in");
    fireEvent.click(screen.getAllByRole("button", { name: /New webhook/ })[0] as HTMLElement);
    fireEvent.change(await screen.findByLabelText("Endpoint URL"), {
      target: { value: "https://hooks.acme.in/qeet-id" },
    });
    fireEvent.click(await screen.findByRole("checkbox", { name: /user\.deleted/ }));
    fireEvent.click(screen.getByRole("button", { name: /Create webhook/ }));
    expect(
      await screen.findByText("Copy the signing secret now. You won't see it again."),
    ).toBeTruthy();
    expect(calls.find((c) => c.method === "POST" && c.path === "/v1/webhooks")?.body).toMatchObject(
      {
        url: "https://hooks.acme.in/qeet-id",
        events: ["user.deleted"],
      },
    );
  });
});

describe("A webhook's page", () => {
  it("says why it's off and what becomes of its deliveries", async () => {
    renderWith(<WebhookPage id="w-off" />);
    expect(
      await screen.findByRole("heading", { level: 1, name: /staging-api\.qeet\.in/ }),
    ).toBeTruthy();
    expect(await screen.findByText(/after 3 days of failed deliveries/)).toBeTruthy();
    expect(
      screen.getByText(/1 delivery is held and goes out when you enable it; 1 gave up/),
    ).toBeTruthy();
  });

  it("lists recent deliveries with their outcome and the endpoint's answer", async () => {
    renderWith(<WebhookPage id="w-off" />);
    const table = within(await screen.findByRole("table", { name: "Recent deliveries" }));
    expect(table.getByText("Held")).toBeTruthy();
    expect(table.getByText("Gave up")).toBeTruthy();
    expect(table.getByText("Delivered")).toBeTruthy();
    expect(table.getAllByText("Host not found").length).toBe(2);
    expect(table.getByText("After 60 attempts")).toBeTruthy();
  });

  it("opens a delivery with its request, and retries one that gave up", async () => {
    renderWith(<WebhookPage id="w-off" />);
    const table = within(await screen.findByRole("table", { name: "Recent deliveries" }));
    fireEvent.click(table.getByRole("button", { name: /Delivery d-dead-0/ }));
    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByText("It used all its attempts")).toBeTruthy();
    expect(within(drawer).getByText("Request body")).toBeTruthy();
    fireEvent.click(within(drawer).getByRole("button", { name: "Retry now" }));
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.method === "POST" && c.path === "/v1/webhooks/w-off/deliveries/d-dead-0002/retry",
        ),
      ).toBe(true),
    );
  });

  it("shows the events it gets, by area", async () => {
    renderWith(<WebhookPage id="w-off" />);
    await screen.findByRole("heading", { name: "Events it gets" });
    expect(screen.getByText("Sign-in and sessions")).toBeTruthy();
    expect(screen.getByText("People")).toBeTruthy();
  });
});
