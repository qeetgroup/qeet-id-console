// @vitest-environment jsdom
import { QeetrixProvider } from "@qeetrix/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@/i18n";

const navigate = vi.fn();
const acceptWithPasskey = vi.fn();
const me = vi.hoisted(() => ({
  current: { email: "priya@acme.in", display_name: "Priya Sharma" },
}));

vi.mock("@/platform/api/client", async () => {
  const { ApiError } = await vi.importActual<typeof import("@/platform/errors/api-error")>(
    "@/platform/errors/api-error",
  );
  return { api: vi.fn(), ApiError };
});
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props} />
  ),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// The passkey ceremony needs a real authenticator; the page only hands it the token and name.
vi.mock("@/modules/authentication/api/passkey-flows", () => ({
  passkeyErrorMessage: (e: unknown) => String(e),
  useAcceptInviteWithPasskey: () => ({
    mutate: acceptWithPasskey,
    reset: vi.fn(),
    isPending: false,
    error: null,
  }),
}));
vi.mock("@/platform/auth/session", () => ({
  useMe: () => ({ data: me.current, isPending: false, isError: false }),
  useLogout: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { api } from "@/platform/api/client";
import type { PublicSession } from "@/platform/auth/server-session";
import { ApiError } from "@/platform/errors/api-error";
import { AcceptInvitePage } from "../components/accept-invite-page";

const SIGNED_OUT = { isAuthenticated: false } as PublicSession;
const SIGNED_IN = {
  isAuthenticated: true,
  userId: "u1",
  tenantId: null,
  sessionId: "s1",
  expiresAt: null,
  version: 1,
  impersonationActor: null,
} as PublicSession;

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    organization: { name: "Acme Pvt Ltd", slug: "acme" },
    email: "priya@acme.in",
    expires_at: "2026-11-02T12:00:00Z",
    account_exists: false,
    methods: { password: true, passkey: true },
    ...overrides,
  };
}

function lookupAnswers(preview: unknown) {
  vi.mocked(api).mockImplementation((path: string) =>
    path === "/v1/invites/lookup"
      ? preview instanceof Error
        ? Promise.reject(preview)
        : Promise.resolve(preview)
      : new Promise(() => {}),
  );
}

function renderPage(token: string, session: PublicSession = SIGNED_OUT) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      {/* The page's theme menu needs the provider __root.tsx supplies in-app. */}
      <QeetrixProvider defaultColorScheme="light">
        <AcceptInvitePage token={token} session={session} />
      </QeetrixProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  me.current = { email: "priya@acme.in", display_name: "Priya Sharma" };
});
afterEach(() => {
  cleanup();
  vi.mocked(api).mockReset();
  navigate.mockReset();
  acceptWithPasskey.mockReset();
});

describe("an invitation link, signed out", () => {
  it("names the organisation and joins with a passkey first", async () => {
    lookupAnswers(invitation());
    renderPage("tok");
    await screen.findByRole("heading", { level: 1, name: "Join Acme Pvt Ltd" });
    const email = screen.getByLabelText("Work email") as HTMLInputElement;
    expect(email.value).toBe("priya@acme.in");
    expect(email.readOnly).toBe(true);
    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: " Priya " } });
    fireEvent.click(screen.getByRole("button", { name: "Join with a passkey" }));
    await waitFor(() =>
      expect(acceptWithPasskey).toHaveBeenCalledWith({ token: "tok", display_name: "Priya" }),
    );
  });

  it("joins with a password instead", async () => {
    lookupAnswers(invitation());
    renderPage("tok");
    fireEvent.click(await screen.findByRole("button", { name: "Use a password instead" }));
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse" } });
    fireEvent.click(screen.getByRole("button", { name: "Join with a password" }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/v1/invites/accept", {
        method: "POST",
        body: { token: "tok", password: "correct horse", display_name: undefined },
        anonymous: true,
      }),
    );
  });

  it("offers only a password where the organisation allows no passkeys", async () => {
    lookupAnswers(invitation({ methods: { password: true, passkey: false } }));
    renderPage("tok");
    await screen.findByRole("button", { name: "Join with a password" });
    expect(screen.queryByRole("button", { name: /passkey/ })).toBeNull();
  });

  it("sends an address that already has a Qeet ID to sign in", async () => {
    lookupAnswers(invitation({ account_exists: true }));
    renderPage("tok");
    await screen.findByText("priya@acme.in already has a Qeet ID.");
    expect(screen.queryByLabelText("Work email")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(navigate).toHaveBeenCalledWith({ to: "/sign-in" });
  });

  it("says why an expired invitation can't be used", async () => {
    lookupAnswers(new ApiError(410, "invite.expired", "backend text"));
    renderPage("tok");
    await screen.findByRole("heading", { name: "This invitation can’t be used" });
    expect(screen.getByText("This invitation has expired. Ask for a new one.")).toBeTruthy();
    expect(screen.queryByText("backend text")).toBeNull();
  });

  it("explains a link without its token", () => {
    renderPage("");
    expect(screen.getByRole("heading", { name: "This link is incomplete" })).toBeTruthy();
    expect(api).not.toHaveBeenCalled();
  });
});

describe("an invitation link, signed in", () => {
  it("accepts it as the signed-in account", async () => {
    lookupAnswers(invitation({ account_exists: true }));
    renderPage("tok", SIGNED_IN);
    await screen.findByText("Priya Sharma");
    fireEvent.click(screen.getByRole("button", { name: "Accept and join" }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/v1/me/invites/accept", {
        method: "POST",
        body: { token: "tok" },
      }),
    );
  });

  it("says who the invitation is for when another address is signed in", async () => {
    me.current = { email: "priya@personal.in", display_name: "Priya Sharma" };
    lookupAnswers(invitation({ account_exists: true }));
    renderPage("tok", SIGNED_IN);
    await screen.findByText("This invitation is for priya@acme.in");
    expect(screen.queryByRole("button", { name: "Accept and join" })).toBeNull();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });
});
