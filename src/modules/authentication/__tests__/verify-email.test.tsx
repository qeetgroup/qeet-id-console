// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import "@/i18n";

vi.mock("@/platform/api/client", async () => {
  const { ApiError } = await vi.importActual<typeof import("@/platform/errors/api-error")>(
    "@/platform/errors/api-error",
  );
  return { api: vi.fn(), ApiError };
});
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
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

describe("VerifyEmailStep", () => {
  it("keeps a code pasted with whitespace around it, as copied from the email", () => {
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
    const input = screen.getByLabelText("Verification code") as HTMLInputElement;
    // A maxLength would cut "\n 063367" to "\n 0633" before the digits are taken.
    expect(input.hasAttribute("maxlength")).toBe(false);

    fireEvent.change(input, { target: { value: "\n 063367 \n" } });
    expect(input.value).toBe("063367");
    fireEvent.click(screen.getByRole("button", { name: "Verify email" }));
    expect(onSubmit).toHaveBeenCalledWith("063367");
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
        <VerifyEmailPage session={session} />
      </QueryClientProvider>,
    );
    expect(sessionStore.getUserId()).toBe("user-1");

    fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "063367" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify email" }));
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
