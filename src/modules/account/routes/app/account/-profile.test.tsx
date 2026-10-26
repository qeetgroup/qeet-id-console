// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", async () => {
  const { ApiError } = await import("@/platform/errors/api-error");
  return { api: vi.fn(), ApiError };
});
vi.mock("@/platform/auth/session", () => ({
  useMe: () => ({
    data: {
      id: "6f1c2e2a-0000-4000-8000-000000000001",
      email: "ada@example.com",
      display_name: "Ada",
      email_verified_at: "2026-03-12T09:00:00Z",
      created_at: "2026-03-12T09:00:00Z",
      metadata: {},
    },
    refetch: vi.fn(),
  }),
  meKeys: { all: ["me"] },
  useSessionId: () => "session-1",
  useTenantId: () => "org-1",
  useUserId: () => "user-1",
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ to, children, ...props }: { to: string; children?: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
// Records what each action hands the real sensitive-action runner.
const sensitiveCalls = vi.hoisted(() => [] as { actionLabel?: string; confirm?: unknown }[]);
vi.mock("@/platform/security/sensitive-action-provider", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/platform/security/sensitive-action-provider")>();
  return {
    ...actual,
    useSensitiveAction: () => {
      const run = actual.useSensitiveAction();
      return (o: Parameters<typeof run>[0]) => {
        sensitiveCalls.push(o);
        return run(o);
      };
    },
  };
});

import { toast } from "sonner";
import { api } from "@/platform/api/client";
import { ApiError } from "@/platform/errors/api-error";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./profile";

const ProfilePage = Route.options.component as () => React.JSX.Element;

let startBodies: unknown[];
let startError: unknown;
let patchBodies: unknown[];

const org = (id: string, name: string) => ({
  id,
  name,
  slug: id,
  plan: "free",
  region: "in",
  logo_url: "",
  domain: "",
  roles: ["owner"],
});

beforeEach(() => {
  startBodies = [];
  startError = null;
  sensitiveCalls.length = 0;
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  vi.mocked(api).mockReset();
  patchBodies = [];
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/v1/me/organizations") {
      return {
        items: [org("org-1", "Org One"), org("6f1c2e2a-0000-4000-8000-000000000002", "Org Two")],
        next_cursor: "",
      };
    }
    if (path === "/v1/auth/sessions") return { items: [] };
    if (path === "/v1/me" && options?.method === "PATCH") {
      patchBodies.push(options.body);
      return {};
    }
    if (path === "/v1/me/email/change/start" && options?.method === "POST") {
      startBodies.push(options.body);
      if (startError) throw startError;
      return { message: "sent" };
    }
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
        <ProfilePage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

function sendCodeTo(email: string) {
  fireEvent.click(screen.getByRole("button", { name: "Change" }));
  fireEvent.change(screen.getByLabelText("New email address"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: "Send code" }));
}

describe("Account › Profile", () => {
  it("shows who is signed in, then the facts about the account", async () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 2, name: "Ada" })).toBeTruthy();
    expect(screen.getByText("Verified")).toBeTruthy();
    expect(await screen.findByText("Member of 2 organisations")).toBeTruthy();
    expect(screen.getByText("Org One is open now.")).toBeTruthy();
    expect(screen.getByText(/^(March 12, 2026|12 March 2026)$/)).toBeTruthy();
    expect(screen.getByText("6f1c2e2a-0000-4000-8000-000000000001")).toBeTruthy();
  });

  it("changes the name where it's shown, and saves only the name", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "  Ada Lovelace " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(patchBodies).toEqual([{ display_name: "Ada Lovelace" }]));
  });
});

describe("Account › Profile › change email", () => {
  it("starts the change as a sensitive action, without a confirmation", async () => {
    renderPage();
    sendCodeTo(" new@example.com ");

    await waitFor(() => expect(startBodies).toEqual([{ email: "new@example.com" }]));
    expect(sensitiveCalls).toEqual([
      expect.objectContaining({ actionLabel: "Change your email address" }),
    ]);
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
    // The mutation's own success toast reports it; the page asks for the code.
    expect(await screen.findByText("Check your new inbox")).toBeTruthy();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("says why the change could not start, without the server's wording", async () => {
    startError = new ApiError(400, "validation", "internal detail");
    renderPage();
    sendCodeTo("new@example.com");

    // The form says why inline, in curated copy, and asks for no code.
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).not.toContain("internal detail");
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByText("Check your new inbox")).toBeNull();
  });
});
