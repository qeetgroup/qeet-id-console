// @vitest-environment jsdom
import { QeetrixProvider } from "@qeetrix/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
import { ApiError } from "@/platform/errors/api-error";
import { MagicLinkPage } from "../components/magic-link-page";

function renderPage(token?: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      {/* The page's theme menu needs the provider __root.tsx supplies in-app. */}
      <QeetrixProvider defaultColorScheme="light">
        <MagicLinkPage token={token} />
      </QeetrixProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.mocked(api).mockReset();
});

describe("MagicLinkPage", () => {
  it("sends a link and says where it went", async () => {
    vi.mocked(api).mockResolvedValue({ message: "ok" });
    renderPage();
    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "jane@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send sign-in link" }));
    await screen.findByRole("heading", { name: "Check your email" });
    expect(api).toHaveBeenCalledWith("/v1/auth/magic-link/start", {
      method: "POST",
      body: { email: "jane@example.com" },
      anonymous: true,
    });
    expect(screen.getByText("jane@example.com")).toBeTruthy();
  });

  it("offers a new link for an expired one, and confirms when it's sent", async () => {
    vi.mocked(api).mockImplementation((path: string) =>
      path === "/v1/auth/magic-link/consume"
        ? Promise.reject(new ApiError(400, "auth.magic_link_expired", "expired"))
        : Promise.resolve({ message: "ok" }),
    );
    renderPage("spent-token");
    await screen.findByRole("heading", { name: "Link no longer valid" });
    fireEvent.click(screen.getByRole("button", { name: "Send a new link" }));
    await screen.findByText("New link sent");
    expect(api).toHaveBeenCalledWith("/v1/auth/magic-link/resend", {
      method: "POST",
      body: { token: "spent-token" },
      anonymous: true,
    });
  });
});
