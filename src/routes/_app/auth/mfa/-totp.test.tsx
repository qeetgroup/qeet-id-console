// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClientProvider } from "@tanstack/react-query";
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

import { toast } from "sonner";
import { api } from "@/platform/api/client";
import { ApiError } from "@/platform/errors/api-error";
import { getContext } from "@/platform/query/query-client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./totp";

const TotpPage = Route.options.component as () => React.JSX.Element;

let enrolled: boolean;
let recoveryTotal: number;
let regenerate: () => Promise<unknown>;

beforeEach(() => {
  enrolled = true;
  recoveryTotal = 10;
  regenerate = async () => ({ recovery_codes: ["aaaa-bbbb"], warning: "" });
  sensitiveCalls.length = 0;
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/mfa/totp" && method === "GET") return { enrolled };
    if (path === "/v1/mfa/recovery-codes")
      return { remaining: recoveryTotal, total: recoveryTotal };
    if (path === "/v1/mfa/totp/enroll/start") {
      return { secret: "JBSWY3DPEHPK3PXP", provisioning_url: "otpauth://totp/x?secret=y" };
    }
    if (path === "/v1/mfa/totp" && method === "DELETE") return undefined;
    if (path === "/v1/mfa/recovery-codes/regenerate") return regenerate();
    throw new Error(`Unexpected request ${method} ${path}`);
  });
});

afterEach(cleanup);

// The app's query client, so the shared success and error toasts run as they do in the console.
function renderPage() {
  render(
    <QueryClientProvider client={getContext().queryClient}>
      <SensitiveActionProvider>
        <TotpPage />
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

async function confirmation(title: string) {
  const dialog = await screen.findByRole("alertdialog");
  expect(within(dialog).getByText(title)).toBeTruthy();
  return dialog;
}

describe("MFA › Authenticator app", () => {
  it("sets up a first app without a confirmation, worded for setting one up", async () => {
    enrolled = false;
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Begin enrollment" }));

    await waitFor(() => expect(writes()).toEqual(["POST /v1/mfa/totp/enroll/start"]));
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "set up an authenticator app" });
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("confirms replacing the app before starting the new one", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Replace authenticator" }));
    const dialog = await confirmation("Replace your authenticator?");
    expect(writes()).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Replace" }));
    await waitFor(() => expect(writes()).toEqual(["POST /v1/mfa/totp/enroll/start"]));
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "replace your authenticator app" });
  });

  it("disables the app only once confirmed, and says so once", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Disable TOTP" }));
    const dialog = await confirmation("Disable TOTP for your account?");

    fireEvent.click(within(dialog).getByRole("button", { name: "Disable TOTP" }));
    await waitFor(() => expect(writes()).toEqual(["DELETE /v1/mfa/totp"]));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("TOTP disabled", expect.anything()),
    );
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "disable TOTP" });
  });

  it("changes nothing when disabling is cancelled", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Disable TOTP" }));
    const dialog = await confirmation("Disable TOTP for your account?");

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(writes()).toEqual([]);
  });

  it("confirms regenerating recovery codes, since the old ones stop working", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Regenerate codes" }));
    const dialog = await confirmation("Regenerate your recovery codes?");

    fireEvent.click(within(dialog).getByRole("button", { name: "Regenerate" }));
    await waitFor(() => expect(writes()).toEqual(["POST /v1/mfa/recovery-codes/regenerate"]));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("New recovery codes generated"));
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "regenerate your recovery codes" });
  });

  it("generates the first recovery codes without a confirmation", async () => {
    recoveryTotal = 0;
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Generate codes" }));

    await waitFor(() => expect(writes()).toEqual(["POST /v1/mfa/recovery-codes/regenerate"]));
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("reports a failed regeneration once, without the backend's message", async () => {
    recoveryTotal = 0;
    regenerate = async () => {
      throw new ApiError(500, "internal", "boom");
    };
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Generate codes" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(vi.mocked(toast.error).mock.calls)).not.toContain("boom");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("says nothing more when the person backs out of the step-up", async () => {
    recoveryTotal = 0;
    regenerate = async () => {
      throw new ApiError(403, "step_up_required", "step up");
    };
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Generate codes" }));

    await waitFor(() => expect(writes()).toEqual(["POST /v1/mfa/recovery-codes/regenerate"]));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
