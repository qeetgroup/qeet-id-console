// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({
  useSessionId: () => "current",
  useUserId: () => "user-1",
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
}));

import { toast } from "sonner";
import type { Session } from "@/modules/authentication";
import { api } from "@/platform/api/client";
import { ApiError } from "@/platform/errors/api-error";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./sessions";

const SessionsPage = Route.options.component as () => React.JSX.Element;

function session(id: string, revoked = false): Session {
  const now = new Date().toISOString();
  return {
    id,
    user_id: "user-1",
    tenant_id: "",
    ip: "203.0.113.9",
    user_agent: "Mozilla/5.0 Chrome",
    created_at: now,
    last_seen_at: now,
    revoked_at: revoked ? now : null,
  };
}

// The first page the screen loads. `has_more` says older sessions exist that
// the screen has not loaded — the action must still end those.
let listedPage: { items: Session[]; has_more: boolean };
let revokeOthers: () => Promise<unknown>;
let revokeAll: () => Promise<unknown>;

beforeEach(() => {
  listedPage = {
    items: [session("current"), session("other-1"), session("other-2", true)],
    has_more: true,
  };
  revokeOthers = async () => ({ revoked: 57 });
  revokeAll = async () => ({ revoked: 9, sessions: 4, hosted_login_sessions: 2, app_grants: 3 });
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/v1/auth/sessions" && (options?.method ?? "GET") === "GET") return listedPage;
    if (path === "/v1/auth/sessions/revoke-others" && options?.method === "POST")
      return revokeOthers();
    if (path === "/v1/auth/sessions/revoke-all" && options?.method === "POST") return revokeAll();
    if (path.startsWith("/v1/auth/sessions/") && options?.method === "DELETE") return undefined;
    throw new Error(`Unexpected request ${options?.method ?? "GET"} ${path}`);
  });
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  navigate.mockReset();
});

afterEach(cleanup);

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <SessionsPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

async function signOutOtherSessions() {
  const trigger = await screen.findByRole("button", { name: /sign out (other|elsewhere)/i });
  fireEvent.click(trigger);
  const cancel = await screen.findByRole("button", { name: "Cancel" });
  const dialog = cancel.closest('[role="dialog"], [role="alertdialog"]');
  if (!dialog) throw new Error("Confirmation dialog is missing");
  fireEvent.click(within(dialog as HTMLElement).getByRole("button", { name: /sign out/i }));
}

function requests() {
  return vi.mocked(api).mock.calls.map(([path, options]) => `${options?.method ?? "GET"} ${path}`);
}

describe("Account › Sessions › sign out other sessions", () => {
  it("ends every other session with one server call and says how many ended", async () => {
    renderPage();
    await signOutOtherSessions();

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(requests().filter((r) => !r.startsWith("GET "))).toEqual([
      "POST /v1/auth/sessions/revoke-others",
    ]);
    expect(String(vi.mocked(toast.success).mock.calls[0]?.[0])).toContain("57");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("reports a failure instead of success when the sessions could not be ended", async () => {
    revokeOthers = async () => {
      throw new ApiError(500, "internal", "boom");
    };
    renderPage();
    await signOutOtherSessions();

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(toast.error).mock.calls)).not.toContain("boom");
  });

  it("is offered even when the loaded page shows no other live session", async () => {
    listedPage = { items: [session("current"), session("old", true)], has_more: true };
    revokeOthers = async () => ({ revoked: 0 });
    renderPage();
    await signOutOtherSessions();

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(requests()).toContain("POST /v1/auth/sessions/revoke-others");
    expect(String(vi.mocked(toast.success).mock.calls[0]?.[0])).toMatch(/no other session/i);
  });
});

// Opens the sign-out-everywhere confirmation, confirms it and returns its text.
async function signOutEverywhere(): Promise<string> {
  const trigger = await screen.findByRole("button", { name: /sign out everywhere/i });
  fireEvent.click(trigger);
  const cancel = await screen.findByRole("button", { name: "Cancel" });
  const dialog = cancel.closest('[role="dialog"], [role="alertdialog"]') as HTMLElement | null;
  if (!dialog) throw new Error("Confirmation dialog is missing");
  const text = dialog.textContent ?? "";
  fireEvent.click(within(dialog).getByRole("button", { name: /sign out everywhere/i }));
  return text;
}

describe("Account › Sessions › sign out everywhere", () => {
  it("signs out everywhere with one server call, says how many sign-ins ended, then asks to sign in again", async () => {
    renderPage();
    const confirmation = await signOutEverywhere();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/sign-in" }));
    expect(requests().filter((r) => !r.startsWith("GET "))).toEqual([
      "POST /v1/auth/sessions/revoke-all",
    ]);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(toast.success).mock.calls[0]?.[0])).toContain("9");
    expect(toast.error).not.toHaveBeenCalled();
    // Access already issued lasts a few minutes: neither the confirmation nor
    // the result may promise an instant cut-off everywhere.
    expect(confirmation).toMatch(/this one/i);
    expect(confirmation).toMatch(/few (more )?minutes/i);
    expect(JSON.stringify(vi.mocked(toast.success).mock.calls[0])).toMatch(/few (more )?minutes/i);
  });

  it("keeps the person signed in here and reports a failure when it could not be done", async () => {
    revokeAll = async () => {
      throw new ApiError(500, "internal", "boom");
    };
    renderPage();
    await signOutEverywhere();

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(toast.error).mock.calls)).not.toContain("boom");
  });
});

// Opens the confirmation for revoking the session at `row` and returns its dialog.
async function openRevokeConfirmation(row: number): Promise<HTMLElement> {
  const revoke = (await screen.findAllByRole("button", { name: /^revoke$/i }))[row];
  if (!revoke) throw new Error("Revoke button is missing");
  fireEvent.click(revoke);
  return screen.findByRole("alertdialog");
}

describe("Account › Sessions › revoke one session", () => {
  it("asks for confirmation before revoking the session", async () => {
    renderPage();
    const dialog = await openRevokeConfirmation(1);

    expect(within(dialog).getByText("Revoke this session?")).toBeTruthy();
    expect(requests()).not.toContain("DELETE /v1/auth/sessions/other-1");
    fireEvent.click(within(dialog).getByRole("button", { name: /^revoke$/i }));

    await waitFor(() => expect(requests()).toContain("DELETE /v1/auth/sessions/other-1"));
  });

  it("changes nothing when the confirmation is cancelled", async () => {
    renderPage();
    const dialog = await openRevokeConfirmation(1);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(requests().filter((r) => !r.startsWith("GET "))).toEqual([]);
  });
});
