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
  useMe: () => ({ data: { email: "ada@example.com" } }),
}));
vi.mock("@simplewebauthn/browser", () => ({ startRegistration: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
// The page's other cards link elsewhere in the console; a plain anchor keeps
// their targets visible without a router.
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

import { startRegistration } from "@simplewebauthn/browser";
import type { Passkey } from "@/modules/authentication";
import { api } from "@/platform/api/client";
import { Route } from "./security";

const SecurityPage = Route.options.component as () => React.JSX.Element;

const passkey: Passkey = {
  id: "pk1",
  user_id: "user-1",
  name: "Chrome on macOS",
  transports: ["internal"],
  created_at: "2026-10-01T10:00:00Z",
  last_used_at: null,
};

// What GET /v1/passkeys returns; enrollment_allowed is false when the user's
// organization has passkeys switched off.
let listed: { items: Passkey[]; enrollment_allowed: boolean };
let finishBodies: unknown[];

beforeEach(() => {
  listed = { items: [passkey], enrollment_allowed: true };
  finishBodies = [];
  vi.mocked(startRegistration).mockReset();
  vi.mocked(startRegistration).mockResolvedValue({ id: "cred-1" } as never);
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/passkeys" && method === "GET") return listed;
    if (path === "/v1/passkeys/register/begin" && method === "POST")
      return { session_id: "ceremony-1", publicKey: { challenge: "abc" } };
    if (path === "/v1/passkeys/register/finish" && method === "POST") {
      finishBodies.push(options?.body);
      return undefined;
    }
    if (path === "/v1/auth/password") return { has_password: true };
    if (path === "/v1/me/social/identities") return { items: [] };
    if (path === "/v1/social/platform/providers") return { providers: [] };
    if (path === "/v1/auth/trusted-devices") return { items: [] };
    throw new Error(`Unexpected request ${method} ${path}`);
  });
});

afterEach(cleanup);

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SecurityPage />
    </QueryClientProvider>,
  );
}

const addButton = () => screen.findByRole("button", { name: "Add passkey" });

describe("Account › Security: passkeys", () => {
  it("lists the user's passkeys and offers adding one right there, not through an admin screen", async () => {
    renderPage();
    expect(await screen.findByText("Chrome on macOS")).toBeTruthy();
    expect(screen.getByRole("button", { name: /rename/i })).toBeTruthy();
    expect(await addButton()).toBeTruthy();
    const adminLinks = screen
      .queryAllByRole("link")
      .filter((a) => a.getAttribute("href")?.startsWith("/auth/login-methods"));
    expect(adminLinks).toEqual([]);
  });

  it("adds a passkey without a name, so the server names it after the browser", async () => {
    renderPage();
    fireEvent.click(await addButton());
    await waitFor(() => expect(finishBodies).toHaveLength(1));
    expect(finishBodies[0]).toEqual({ session_id: "ceremony-1", credential: { id: "cred-1" } });
    expect(startRegistration).toHaveBeenCalledWith({ optionsJSON: { challenge: "abc" } });
  });

  it("adds a passkey with the name the user typed, trimmed", async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText("Name (optional)"), {
      target: { value: "  Work laptop  " },
    });
    fireEvent.click(await addButton());
    await waitFor(() => expect(finishBodies).toHaveLength(1));
    expect(finishBodies[0]).toMatchObject({ name: "Work laptop" });
  });

  it("says so calmly when the browser prompt is dismissed", async () => {
    vi.mocked(startRegistration).mockRejectedValue(
      Object.assign(new Error("The operation either timed out or was not allowed."), {
        name: "NotAllowedError",
      }),
    );
    renderPage();
    fireEvent.click(await addButton());
    expect((await screen.findByRole("alert")).textContent).toBe(
      "The passkey wasn't created. You can try again.",
    );
    expect(finishBodies).toHaveLength(0);
  });

  it("does not offer adding a passkey when the organization has passkeys switched off", async () => {
    listed = { items: [], enrollment_allowed: false };
    renderPage();
    expect(
      await screen.findByText("Your organization has turned off passkeys, so you can't add one."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add passkey" })).toBeNull();
  });
});
