// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", async () => {
  const { ApiError } = await import("@/platform/errors/api-error");
  return { api: vi.fn(), ApiError };
});
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "tenant-1" }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
vi.mock("@simplewebauthn/browser", () => ({
  startRegistration: vi.fn(async () => ({ id: "credential" })),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/modules/dashboard", async () =>
  (await import("@/modules/authentication/components/methods/__tests__/stubs")).dashboardStub(),
);
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: (await import("@/modules/authentication/components/methods/__tests__/stubs")).RouterLink,
}));
// Records what each action asks the shared sensitive-action runner for, then runs it for real.
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

import { startRegistration } from "@simplewebauthn/browser";
import { renderPage } from "@/modules/authentication/components/methods/__tests__/kit";
import { api } from "@/platform/api/client";
import { Route } from "./passkeys";

const PasskeysPage = Route.options.component as () => React.JSX.Element;

let list: { items: unknown[]; enrollment_allowed?: boolean };
let methods: { total: number };
let finished: Record<string, unknown> | undefined;
let removed: string | undefined;
let renamed: unknown;

beforeEach(() => {
  list = {
    items: [
      {
        id: "p1",
        user_id: "u1",
        name: "MacBook",
        transports: ["internal"],
        created_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
        last_used_at: null,
      },
    ],
  };
  methods = { total: 2 };
  finished = removed = renamed = undefined;
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/passkeys" && method === "GET") return list;
    if (path === "/v1/auth/sign-in-methods") return methods;
    if (path === "/v1/passkeys/register/begin") return { session_id: "s1", publicKey: {} };
    if (path === "/v1/passkeys/register/finish") {
      finished = options?.body as Record<string, unknown>;
      return undefined;
    }
    if (path === "/v1/passkeys/p1" && method === "DELETE") {
      removed = "p1";
      return undefined;
    }
    if (path === "/v1/passkeys/p1" && method === "PATCH") {
      renamed = options?.body;
      return list.items[0];
    }
    throw new Error(`Unexpected request ${method} ${path}`);
  });
});

afterEach(cleanup);

describe("Sign-in › Passkeys (your own)", () => {
  it("lists your passkeys with when each was added and used", async () => {
    renderPage(<PasskeysPage />);
    expect(await screen.findByText("MacBook")).toBeTruthy();
    expect(screen.getByText(/added 3 days ago · not used yet/i)).toBeTruthy();
  });

  it("adds one under the list, with the optional name, behind the step-up", async () => {
    renderPage(<PasskeysPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Add a passkey" }));
    fireEvent.change(screen.getByLabelText("Name (optional)"), {
      target: { value: "Work laptop" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(finished).toMatchObject({ name: "Work laptop" }));
    expect(startRegistration).toHaveBeenCalled();
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "Add a passkey" });
  });

  it("renames one where it's listed", async () => {
    renderPage(<PasskeysPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Rename MacBook" }));
    const row = screen.getByRole("listitem");
    fireEvent.change(within(row).getByRole("textbox"), { target: { value: "Office Mac" } });
    fireEvent.click(within(row).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(renamed).toEqual({ name: "Office Mac" }));
  });

  it("confirms removing one with what happens", async () => {
    renderPage(<PasskeysPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove MacBook" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/you can no longer sign in with it/i)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(removed).toBe("p1"));
  });

  it("won't remove your only way to sign in, and says so", async () => {
    methods = { total: 1 };
    renderPage(<PasskeysPage />);
    await screen.findByText("MacBook");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Remove MacBook" }).getAttribute("aria-disabled"),
      ).toBe("true"),
    );
    expect(screen.getByText(/it's your only way to sign in/i)).toBeTruthy();
  });

  it("says when the organisation has passkeys turned off, and offers no Add", async () => {
    list = { ...list, enrollment_allowed: false };
    renderPage(<PasskeysPage />);
    expect(await screen.findByText(/has turned off passkeys/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add a passkey" })).toBeNull();
  });
});
