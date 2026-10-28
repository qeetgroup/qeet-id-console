// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/platform/api/client")>()),
  api: vi.fn(),
}));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "t-1", useUserId: () => "u-me" }));
const granted = vi.hoisted(() => ({ except: new Set<string>() }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => {
    const can = (c: string) => !granted.except.has(c);
    return { state: "ready", mode: "full", can, canAll: (cs: string[]) => cs.every(can) };
  },
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useLocation: () => ({ pathname: "/security/compliance/retention", searchStr: "", hash: "" }),
  useNavigate: () => vi.fn(),
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
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
const sensitiveCalls = vi.hoisted(() => [] as { actionLabel?: string; confirm?: unknown }[]);
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

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./retention";

const Page = Route.options.component as () => React.JSX.Element;

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();
// Two people deleted 40 and 10 days ago.
const DELETED = [
  {
    id: "u-anil",
    email: "anil@qeet.in",
    display_name: "Anil Bhatia",
    deleted_at: ago(10),
    created_at: ago(400),
  },
  {
    id: "u-ravi",
    email: "ravi@qeet.in",
    display_name: "Ravi Kumar",
    deleted_at: ago(40),
    created_at: ago(500),
  },
];

let policy = { deleted_users_enabled: true, deleted_users_days: 30 };
let due = 1;

// jsdom has no Web Animations; the tables' ScrollArea asks for them after a scroll.
beforeAll(() => {
  Element.prototype.getAnimations ??= () => [];
});

beforeEach(() => {
  granted.except = new Set();
  sensitiveCalls.length = 0;
  policy = { deleted_users_enabled: true, deleted_users_days: 30 };
  due = 1;
  vi.mocked(api).mockImplementation(
    async (path: string, options?: { method?: string; body?: unknown }) => {
      const method = options?.method ?? "GET";
      if (path === "/v1/tenants/t-1/retention" && method === "GET") return policy;
      if (path === "/v1/tenants/t-1/retention" && method === "PUT") return options?.body;
      if (path === "/v1/tenants/t-1/retention/preview" && method === "POST")
        return { ripe_deleted_users: due, deleted_users_days: policy.deleted_users_days };
      if (path === "/v1/tenants/t-1/retention/run" && method === "POST") return { purged: due };
      if (path === "/v1/users") return { items: [] };
      if (path === "/v1/users/deleted") return { items: DELETED };
      if (path.endsWith("/evidence")) return { items: [] };
      throw new Error(`Unexpected request ${method} ${path}`);
    },
  );
});
afterEach(() => {
  cleanup();
  vi.mocked(api).mockReset();
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <Page />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

// A preview is a POST that only counts; everything else that isn't a GET changes something.
const changes = () =>
  vi
    .mocked(api)
    .mock.calls.map(([path, options]) => `${options?.method ?? "GET"} ${path}`)
    .filter((r) => !r.startsWith("GET ") && !r.endsWith("/retention/preview"));

async function confirmDialog(title: string): Promise<HTMLElement> {
  const heading = await screen.findByText(title);
  return heading.closest('[role="alertdialog"], [role="dialog"]') as HTMLElement;
}

describe("Compliance › Retention", () => {
  it("shows the window, who it makes due now, and who is next", async () => {
    renderPage();
    const keep = (await screen.findByText("Keep for")).closest("div") as HTMLElement;
    expect(within(keep).getByText("30 days")).toBeTruthy();
    expect(await screen.findByText("1 person")).toBeTruthy();
    expect(await screen.findByText(/2 people in Deleted\. Next: Anil Bhatia/)).toBeTruthy();
    expect(screen.getByText("Never removed")).toBeTruthy();
    expect(screen.getByText("7 days after they end")).toBeTruthy();
  });

  it("removes the due people only after a confirm that says they can't be restored", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Remove now" }));
    const dialog = await confirmDialog("Remove 1 deleted person for good?");
    expect(within(dialog).getByText(/can't be restored/)).toBeTruthy();
    expect(changes()).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Remove for good" }));
    await waitFor(() => expect(changes()).toEqual(["POST /v1/tenants/t-1/retention/run"]));
    expect(sensitiveCalls.at(-1)?.actionLabel).toBe("Remove deleted people");
  });

  it("turns automatic removal on only after saying who goes within the hour", async () => {
    policy = { deleted_users_enabled: false, deleted_users_days: 30 };
    renderPage();
    await screen.findByText("1 person");
    fireEvent.click(await screen.findByRole("button", { name: "Turn on" }));
    const dialog = await confirmDialog("Turn on automatic removal?");
    await waitFor(() =>
      expect(within(dialog).getByText(/1 person deleted more than 30 days ago/)).toBeTruthy(),
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByText("Turn on automatic removal?")).toBeNull());
    expect(changes()).toEqual([]);
  });

  it("confirms a shorter window that removes more people, then saves it as a sensitive action", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Change" }));
    const field = screen.getByRole("textbox", { name: "Keep for, in days" });
    fireEvent.change(field, { target: { value: "7" } });
    fireEvent.blur(field);
    expect(
      await screen.findByText("At 7 days, 2 people in Deleted would be due now."),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const dialog = await confirmDialog("Keep deleted people for 7 days?");
    expect(within(dialog).getByText(/1 more person, deleted more than 7 days ago/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Save and remove" }));

    await waitFor(() => expect(changes()).toEqual(["PUT /v1/tenants/t-1/retention"]));
    expect(vi.mocked(api)).toHaveBeenCalledWith("/v1/tenants/t-1/retention", {
      method: "PUT",
      body: { deleted_users_enabled: true, deleted_users_days: 7 },
    });
    expect(sensitiveCalls.at(-1)?.actionLabel).toBe("Change the retention policy");
  });

  it("offers no changes without policy.write", async () => {
    granted.except = new Set(["policy.write"]);
    renderPage();
    expect(await screen.findByText("1 person")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Change" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Turn off" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove now" })).toBeNull();
  });
});
