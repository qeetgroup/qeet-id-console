// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/components/page-header", () => ({
  PageHeader: ({ actions }: { actions?: ReactNode }) => <div>{actions}</div>,
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
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

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./sms-email";

const SmsEmailPage = Route.options.component as () => React.JSX.Element;

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/mfa/otp/factors" && method === "GET") {
      return {
        items: [{ id: "f1", channel: "email", destination: "j***@example.com", verified: true }],
      };
    }
    if (path === "/v1/mfa/otp/factors" && method === "POST") {
      return { factor_id: "f2", message: "sent" };
    }
    if (path === "/v1/mfa/otp/factors/f1" && method === "DELETE") return undefined;
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
      <SensitiveActionProvider>
        <SmsEmailPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

function writes() {
  return vi
    .mocked(api)
    .mock.calls.map(([path, options]) => `${options?.method ?? "GET"} ${path}`)
    .filter((r) => !r.startsWith("GET "));
}

describe("MFA › Email and SMS factors", () => {
  it("removes a factor only once the confirmation is accepted", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Remove this email factor?")).toBeTruthy();
    expect(writes()).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(writes()).toEqual(["DELETE /v1/mfa/otp/factors/f1"]));
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "Remove this factor" });
  });

  it("keeps the factor when the confirmation is cancelled", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    const dialog = await screen.findByRole("alertdialog");

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(writes()).toEqual([]);
  });

  it("adds a factor through the step-up path without a confirmation, then asks for the code", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Add factor" }));
    fireEvent.change(await screen.findByLabelText(/^Email address/), {
      target: { value: "jo@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));

    await waitFor(() => expect(writes()).toEqual(["POST /v1/mfa/otp/factors"]));
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "Add a one-time code factor" });
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
    expect(await screen.findByLabelText(/^Verification code/)).toBeTruthy();
  });
});
