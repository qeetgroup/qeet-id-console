// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", async () => {
  const { ApiError } = await import("@/platform/errors/api-error");
  return { api: vi.fn(), ApiError };
});
vi.mock("@/platform/auth/session", () => ({
  useMe: () => ({
    data: { email: "ada@example.com", display_name: "Ada", metadata: {} },
    refetch: vi.fn(),
  }),
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
// Records what each action hands the real sensitive-action runner.
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
import { Route } from "./profile";

const ProfilePage = Route.options.component as () => React.JSX.Element;

let startBodies: unknown[];
let startError: unknown;

beforeEach(() => {
  startBodies = [];
  startError = null;
  sensitiveCalls.length = 0;
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/v1/me/email/change/start" && options?.method === "POST") {
      startBodies.push(options.body);
      if (startError) throw startError;
      return { message: "sent" };
    }
    throw new Error(`Unexpected request ${options?.method ?? "GET"} ${path}`);
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
        <ProfilePage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

function sendCodeTo(email: string) {
  fireEvent.click(screen.getByRole("button", { name: /\bchange$/i }));
  const input = document.querySelector<HTMLInputElement>('input[type="email"]');
  if (!input) throw new Error("New email field is missing");
  fireEvent.change(input, { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: /send/i }));
}

describe("Account › Profile › change email", () => {
  it("starts the change as a sensitive action, without a confirmation", async () => {
    renderPage();
    sendCodeTo(" new@example.com ");

    await waitFor(() => expect(startBodies).toEqual([{ email: "new@example.com" }]));
    expect(sensitiveCalls).toEqual([
      expect.objectContaining({ actionLabel: "change your email address" }),
    ]);
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
    // The mutation's own success toast reports it; the page asks for the code.
    expect(await screen.findByLabelText(/^Code/)).toBeTruthy();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("says why the change could not start, without the server's wording", async () => {
    startError = new ApiError(400, "validation", "internal detail");
    renderPage();
    sendCodeTo("new@example.com");

    // The form says why inline, in curated copy, and asks for no code.
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).not.toContain("internal detail");
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/^Code/)).toBeNull();
  });
});
