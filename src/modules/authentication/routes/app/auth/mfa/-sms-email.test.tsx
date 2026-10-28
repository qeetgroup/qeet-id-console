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

import { renderPage } from "@/modules/authentication/components/methods/__tests__/kit";
import { api } from "@/platform/api/client";
import { Route } from "./sms-email";

const OtpFactorsPage = Route.options.component as () => React.JSX.Element;
const added = new Date(Date.now() - 2 * 86_400_000).toISOString();

let calls: { method: string; path: string; body?: unknown }[];

beforeEach(() => {
  calls = [];
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    calls.push({ method, path, body: options?.body });
    if (path === "/v1/mfa/otp/factors" && method === "GET")
      return {
        items: [
          {
            id: "f1",
            channel: "sms",
            destination: "+91 •••• 3210",
            verified: true,
            created_at: added,
          },
          {
            id: "f2",
            channel: "email",
            destination: "a•••@qeet.in",
            verified: false,
            created_at: added,
          },
        ],
      };
    if (path === "/v1/mfa/otp/factors" && method === "POST")
      return { factor_id: "f3", message: "" };
    if (path.endsWith("/challenge")) return { message: "" };
    if (path.endsWith("/confirm")) return { verified: true };
    if (method === "DELETE") return undefined;
    throw new Error(`Unexpected request ${method} ${path}`);
  });
});

afterEach(cleanup);

describe("MFA › SMS / email (your own)", () => {
  it("lists each number and address, marking the one not confirmed", async () => {
    renderPage(<OtpFactorsPage />);
    expect(await screen.findByText(/\+91 •••• 3210 · added 2 days ago/)).toBeTruthy();
    expect(screen.getByText("Not confirmed")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send a test code to +91 •••• 3210" })).toBeTruthy();
  });

  it("sends a test code to a confirmed one", async () => {
    renderPage(<OtpFactorsPage />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Send a test code to +91 •••• 3210" }),
    );
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: "POST",
        path: "/v1/mfa/otp/factors/f1/challenge",
        body: undefined,
      }),
    );
  });

  it("adds a number: where to send codes, behind the step-up, then the code", async () => {
    renderPage(<OtpFactorsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Add a number or email" }));
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByText("Enter a phone number.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Phone number"), {
      target: { value: "+91 98765 43210" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: "POST",
        path: "/v1/mfa/otp/factors",
        body: { channel: "sms", destination: "+91 98765 43210" },
      }),
    );
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "Add a number or email" });
    expect(await screen.findByText(/we sent a 6-digit code to \+91 98765 43210/i)).toBeTruthy();
    const first = screen.getAllByRole("textbox", { name: /^code/i })[0] as HTMLElement;
    fireEvent.paste(first, { clipboardData: { getData: () => "654321" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: "POST",
        path: "/v1/mfa/otp/factors/f3/confirm",
        body: { code: "654321" },
      }),
    );
  });

  it("confirms removing one with what happens", async () => {
    renderPage(<OtpFactorsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove +91 •••• 3210" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/your other ways to sign in keep working/i)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: "DELETE",
        path: "/v1/mfa/otp/factors/f1",
        body: undefined,
      }),
    );
  });
});
