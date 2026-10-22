// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
  Link: ({ children, to }: { children?: React.ReactNode; to?: unknown }) => (
    <a href={String(to)}>{children}</a>
  ),
}));
vi.mock("@/modules/authentication/api/passkey-flows", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/authentication/api/passkey-flows")>()),
  startPasskeyAutofill: () => () => {},
}));

import { api } from "@/platform/api/client";
import { Route } from "./sign-in";

const SignInPage = Route.options.component as () => React.JSX.Element;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SignInPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(api).mockReset();
  navigate.mockReset();
  window.history.replaceState({}, "", "/sign-in?social_code=one-time-code");
});
afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("returning from a social sign-in", () => {
  it("asks for the second factor when the exchange answers a challenge", async () => {
    vi.mocked(api).mockResolvedValue({
      mfa_required: true,
      mfa_token: "challenge",
      methods: ["totp"],
      factors: [{ type: "totp" }],
    });
    renderPage();
    expect(await screen.findByRole("heading", { name: "Two-factor authentication" })).toBeTruthy();
    expect(api).toHaveBeenCalledWith(
      "/v1/social/exchange",
      expect.objectContaining({ method: "POST", body: { code: "one-time-code" } }),
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it("goes to the console when the exchange signs the person in", async () => {
    vi.mocked(api).mockResolvedValue({ user_id: "user-1", session_id: "s", expires_at: "" });
    renderPage();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/" }));
  });
});
