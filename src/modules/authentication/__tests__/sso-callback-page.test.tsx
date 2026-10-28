// @vitest-environment jsdom
import { QeetrixProvider } from "@qeetrix/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import "@/i18n";

const navigate = vi.fn();
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

import { api } from "@/platform/api/client";
import { ApiError } from "@/platform/errors/api-error";
import { SsoCallbackPage } from "../components/sso-callback-page";

const EXCHANGE = { method: "POST", body: { code: "abc" }, anonymous: true };

function renderPage(hash = "#saml_code=abc") {
  window.history.replaceState(null, "", `/sso/callback${hash}`);
  return render(
    <QueryClientProvider client={new QueryClient()}>
      {/* The page's theme menu needs the provider __root.tsx supplies in-app. */}
      <QeetrixProvider defaultColorScheme="light">
        <SsoCallbackPage />
      </QeetrixProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.mocked(api).mockReset();
  navigate.mockReset();
});

describe("the return from single sign-on", () => {
  it("exchanges the code once and drops it from the address", async () => {
    vi.mocked(api).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole("heading", { name: "Signing you in" })).toBeTruthy();
    expect(screen.getByText("Checking your sign-in code…")).toBeTruthy();
    await waitFor(() => expect(api).toHaveBeenCalledWith("/saml/exchange", EXCHANGE));
    expect(api).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe("");
  });

  it("says a spent code needs a new sign-in", async () => {
    vi.mocked(api).mockRejectedValue(new ApiError(400, "saml.login_code_expired", "backend text"));
    renderPage();
    await screen.findByRole("heading", { name: /^Single sign.on didn’t finish$/ });
    expect(screen.getByText("That sign-in code has expired. Please sign in again.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sign in again" }));
    expect(navigate).toHaveBeenCalledWith({ to: "/sign-in" });
  });

  it("sends the same code again after a lost connection", async () => {
    vi.mocked(api)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockReturnValue(new Promise(() => {}));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", { name: "Signing you in" });
    expect(api).toHaveBeenCalledTimes(2);
    expect(api).toHaveBeenLastCalledWith("/saml/exchange", EXCHANGE);
  });

  it("explains the page when there's no code to exchange", () => {
    renderPage("");
    expect(screen.getByRole("heading", { name: "Nothing to finish here" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(navigate).toHaveBeenCalledWith({ to: "/sign-in" });
    expect(api).not.toHaveBeenCalled();
  });
});
