// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", async () => {
  const { ApiError } = await import("@/platform/errors/api-error");
  return { api: vi.fn(), ApiError, sessionStore: { clear: vi.fn() } };
});
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
import { Route } from "./data";

const DataPage = Route.options.component as () => React.JSX.Element;

let deleteBodies: unknown[];

beforeEach(() => {
  deleteBodies = [];
  sensitiveCalls.length = 0;
  vi.mocked(toast.error).mockReset();
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/v1/auth/password") return { has_password: true };
    if (path === "/v1/account/delete" && options?.method === "POST") {
      deleteBodies.push(options.body);
      // Failing keeps the page from navigating away, which jsdom cannot do.
      throw new ApiError(500, "internal", "boom");
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
        <DataPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

async function openDeleteConfirmation(): Promise<HTMLElement> {
  fireEvent.change(await screen.findByLabelText(/^Your password/), {
    target: { value: "hunter2!" },
  });
  fireEvent.click(screen.getByRole("button", { name: /delete my account/i }));
  return screen.findByRole("alertdialog");
}

describe("Account › Data › delete account", () => {
  it("deletes the account only after a confirmation, as a sensitive action", async () => {
    renderPage();
    const dialog = await openDeleteConfirmation();
    expect(within(dialog).getByText("Delete your account?")).toBeTruthy();
    expect(deleteBodies).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: /delete my account/i }));

    await waitFor(() => expect(deleteBodies).toEqual([{ password: "hunter2!" }]));
    expect(sensitiveCalls.at(-1)?.actionLabel).toBe("Delete my account");
    // The form reports the failure inline, in curated copy; the query client stays silent.
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).not.toContain("boom");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("changes nothing when the confirmation is cancelled", async () => {
    renderPage();
    const dialog = await openDeleteConfirmation();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(deleteBodies).toEqual([]);
  });
});
