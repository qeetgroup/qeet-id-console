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
vi.mock("@simplewebauthn/browser", () => ({
  startRegistration: vi.fn(async () => ({ id: "credential" })),
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

import { toast } from "sonner";
import { api } from "@/platform/api/client";
import { ApiError } from "@/platform/errors/api-error";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./passkeys";

const PasskeysPage = Route.options.component as () => React.JSX.Element;

let begin: () => Promise<unknown>;

beforeEach(() => {
  begin = async () => ({ session_id: "s1", publicKey: {} });
  sensitiveCalls.length = 0;
  vi.mocked(toast.error).mockReset();
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/passkeys" && method === "GET") {
      return {
        items: [
          {
            id: "p1",
            user_id: "u1",
            name: "MacBook",
            transports: ["internal"],
            created_at: new Date().toISOString(),
            last_used_at: null,
          },
        ],
      };
    }
    if (path === "/v1/passkeys/register/begin") return begin();
    if (path === "/v1/passkeys/register/finish") return undefined;
    if (path === "/v1/passkeys/p1" && method === "DELETE") return undefined;
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
        <PasskeysPage />
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

describe("Login methods › Passkeys", () => {
  it("removes a passkey only once the confirmation is accepted", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText('Remove passkey "MacBook"?')).toBeTruthy();
    expect(writes()).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(writes()).toEqual(["DELETE /v1/passkeys/p1"]));
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "Remove this passkey" });
  });

  it("keeps the passkey when the confirmation is cancelled", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    const dialog = await screen.findByRole("alertdialog");

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(writes()).toEqual([]);
  });

  it("registers a passkey through the step-up path without a confirmation", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /register passkey/i }));

    await waitFor(() =>
      expect(writes()).toEqual([
        "POST /v1/passkeys/register/begin",
        "POST /v1/passkeys/register/finish",
      ]),
    );
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "Register a passkey" });
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("reports a failed registration once, without the backend's message", async () => {
    begin = async () => {
      throw new ApiError(500, "internal", "boom");
    };
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /register passkey/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(vi.mocked(toast.error).mock.calls)).not.toContain("boom");
  });

  it("says nothing more when the person backs out of the step-up", async () => {
    begin = async () => {
      throw new ApiError(403, "step_up_required", "step up");
    };
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /register passkey/i }));

    await waitFor(() => expect(writes()).toEqual(["POST /v1/passkeys/register/begin"]));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
