// @vitest-environment jsdom
import { QeetrixProvider } from "@qeetrix/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import "@/i18n";

vi.mock("@/platform/api/client", async () => {
  const { ApiError } = await vi.importActual<typeof import("@/platform/errors/api-error")>(
    "@/platform/errors/api-error",
  );
  return { api: vi.fn(), ApiError };
});
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props} />
  ),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { api } from "@/platform/api/client";
import type { PublicSession } from "@/platform/auth/server-session";
import { sessionStore } from "@/platform/auth/session-store";
import { VerifyEmailPage } from "../components/verify-email-page";
import { VerifyEmailStep } from "../components/verify-email-step";

const session: PublicSession = {
  isAuthenticated: true,
  expiresAt: "2099-01-01T00:00:00Z",
  sessionId: "session-1",
  userId: "user-1",
  tenantId: null,
  version: 1,
  impersonationActor: null,
};

afterEach(() => {
  cleanup();
  vi.mocked(api).mockReset();
});

/** Pastes a code into the first of the six slots, as from the email. */
function pasteCode(code: string) {
  const first = screen.getAllByRole("textbox")[0] as HTMLInputElement;
  fireEvent.paste(first, { clipboardData: { getData: () => code } });
}

describe("VerifyEmailStep", () => {
  it("keeps a code pasted with whitespace around it, as copied from the email", async () => {
    const onSubmit = vi.fn();
    render(
      <VerifyEmailStep
        email="new@example.com"
        isLoading={false}
        isResending={false}
        onResend={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
    pasteCode("\n 063367 \n");
    const verify = screen.getByRole("button", { name: "Verify email" });
    await waitFor(() => expect(verify.matches(":disabled")).toBe(false));
    fireEvent.click(verify);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("063367"));
  });

  it("waits a minute before another resend", () => {
    const onResend = vi.fn();
    render(
      <VerifyEmailStep
        email="new@example.com"
        isLoading={false}
        isResending={false}
        onResend={onResend}
        onSubmit={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Resend code" }));
    expect(onResend).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Resend code" })).toBeNull();
    expect(screen.getByText(/You can resend in/)).toBeTruthy();
  });
});

describe("VerifyEmailPage", () => {
  it("checks and resends the code for the server's session before the profile has loaded", async () => {
    // A reload: the profile request hasn't answered, and only the server knows the session.
    vi.mocked(api).mockImplementation((path: string) =>
      path === "/v1/me" ? new Promise(() => {}) : Promise.resolve({ message: "ok" }),
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        {/* The page's theme menu needs the provider __root.tsx supplies in-app. */}
        <QeetrixProvider defaultColorScheme="light">
          <VerifyEmailPage session={session} />
        </QeetrixProvider>
      </QueryClientProvider>,
    );
    expect(sessionStore.getUserId()).toBe("user-1");

    pasteCode("063367");
    const verify = screen.getByRole("button", { name: "Verify email" });
    await waitFor(() => expect(verify.matches(":disabled")).toBe(false));
    fireEvent.click(verify);
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/v1/users/user-1/verify/email/confirm", {
        method: "POST",
        body: { code: "063367" },
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Resend code" }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/v1/users/user-1/verify/email/start", {
        method: "POST",
        body: {},
      }),
    );
  });
});
