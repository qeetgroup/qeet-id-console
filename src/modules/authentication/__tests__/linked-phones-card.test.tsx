// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, assert, beforeEach, describe, expect, it, vi } from "vitest";

import "@/i18n";

vi.mock("@/platform/api/client", async () => {
  const { ApiError } = await vi.importActual<typeof import("@/platform/errors/api-error")>(
    "@/platform/errors/api-error",
  );
  return { api: vi.fn(), ApiError };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
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

import { api } from "@/platform/api/client";
import { ApiError } from "@/platform/errors/api-error";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { toast } from "sonner";
import { LinkedPhonesCard } from "../components/linked-phones-card";
import { LinkPhoneDialog } from "../components/link-phone-dialog";

const phones = [
  {
    id: "p1",
    name: "Sai's iPhone",
    platform: "ios",
    created_at: "2026-10-01T10:00:00Z",
    last_seen_at: "2026-10-15T10:00:00Z",
  },
  {
    id: "p2",
    name: "",
    platform: "android",
    created_at: "2026-09-20T10:00:00Z",
    last_seen_at: "2026-09-20T10:00:00Z",
  },
];

type Call = { path: string; method: string };
let calls: Call[];
let pairingStatus: "pending" | "linked" | "expired";
let pairingExpires: string;
let startError: unknown;

beforeEach(() => {
  calls = [];
  pairingStatus = "pending";
  pairingExpires = new Date(Date.now() + 5 * 60_000).toISOString();
  startError = null;
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    calls.push({ path, method });
    if (path === "/v1/mfa/push/pairing" && method === "POST") {
      if (startError) throw startError;
      return { id: "pair-1", code: "ABCDE-FGHJK", status: "pending", expires_at: pairingExpires };
    }
    if (path.startsWith("/v1/mfa/push/pairing/") && method === "GET") {
      return { id: "pair-1", status: pairingStatus, expires_at: pairingExpires };
    }
    if (method === "DELETE") return undefined;
    return { items: phones };
  });
});

afterEach(cleanup);

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>{ui}</SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

const deleted = () => calls.filter((c) => c.method === "DELETE").map((c) => c.path);

describe("LinkedPhonesCard", () => {
  it("lists the person's linked phones, naming an unnamed one by its platform", async () => {
    wrap(<LinkedPhonesCard scope={{ kind: "self" }} />);
    expect(await screen.findByText("Sai's iPhone")).toBeTruthy();
    expect(screen.getAllByText("Android").length).toBeGreaterThan(0);
    expect(calls[0]?.path).toBe("/v1/mfa/push/devices");
    expect(screen.getByRole("button", { name: /link a phone/i })).toBeTruthy();
  });

  it("removes one of the person's phones after a confirmation, as a sensitive action", async () => {
    wrap(<LinkedPhonesCard scope={{ kind: "self" }} />);
    await screen.findByText("Sai's iPhone");
    const secondRemove = screen.getAllByRole("button", { name: /^remove$/i })[1];
    assert(secondRemove, "expected a second Remove button");
    fireEvent.click(secondRemove);
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Remove Android?")).toBeTruthy();
    expect(deleted()).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: /^remove$/i }));
    await waitFor(() => expect(deleted()).toContain("/v1/mfa/push/devices/p2"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Phone removed"));
    expect(sensitiveCalls.at(-1)?.actionLabel).toBe("remove this phone");
  });

  it("keeps the phone when the confirmation is cancelled", async () => {
    wrap(<LinkedPhonesCard scope={{ kind: "self" }} />);
    await screen.findByText("Sai's iPhone");
    const firstRemove = screen.getAllByRole("button", { name: /^remove$/i })[0];
    assert(firstRemove, "expected a Remove button");
    fireEvent.click(firstRemove);
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(deleted()).toEqual([]);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("lets an administrator remove one of a member's phones, and cannot link one for them", async () => {
    wrap(<LinkedPhonesCard scope={{ kind: "member", userId: "u1" }} />);
    await screen.findByText("Sai's iPhone");
    expect(calls[0]?.path).toBe("/v1/users/u1/push-devices");
    expect(screen.queryByRole("button", { name: /link a phone/i })).toBeNull();
    const firstRemove = screen.getAllByRole("button", { name: /^remove$/i })[0];
    assert(firstRemove, "expected a Remove button");
    fireEvent.click(firstRemove);
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/stops approving this person's sign-ins/i)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: /^remove$/i }));
    await waitFor(() => expect(deleted()).toContain("/v1/users/u1/push-devices/p1"));
  });

  it("shows a member's phones without the remove action to someone who cannot change them", async () => {
    wrap(<LinkedPhonesCard scope={{ kind: "member", userId: "u1" }} canRemove={false} />);
    await screen.findByText("Sai's iPhone");
    expect(screen.queryByRole("button", { name: /remove/i })).toBeNull();
  });
});

describe("LinkPhoneDialog", () => {
  it("asks for a pairing code on opening and shows it to scan or type, with the time left", async () => {
    wrap(<LinkPhoneDialog open onOpenChange={() => {}} />);
    expect((await screen.findByTestId("pairing-code")).textContent).toBe("ABCDE-FGHJK");
    expect(calls).toContainEqual({ path: "/v1/mfa/push/pairing", method: "POST" });
    expect(screen.getByText(/expires in [45]:\d\d/i)).toBeTruthy();
    // Asking for a code is step-up gated: it runs as a sensitive action, without a confirmation.
    expect(sensitiveCalls).toEqual([expect.objectContaining({ actionLabel: "link a phone" })]);
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("closes and confirms once the phone has linked", async () => {
    pairingStatus = "linked";
    const onOpenChange = vi.fn();
    wrap(<LinkPhoneDialog open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(toast.success).toHaveBeenCalledWith("Phone linked. It can now approve your sign-ins.");
  });

  it("withdraws an unused code when closed", async () => {
    const onOpenChange = vi.fn();
    wrap(<LinkPhoneDialog open onOpenChange={onOpenChange} />);
    await screen.findByTestId("pairing-code");
    await waitFor(() =>
      expect(calls).toContainEqual({ path: "/v1/mfa/push/pairing/pair-1", method: "GET" }),
    );
    // The footer's Close and the dialog's own close button both close it.
    const close = screen.getAllByRole("button", { name: /^close$/i })[0];
    assert(close, "expected a Close button");
    fireEvent.click(close);
    await waitFor(() => expect(deleted()).toContain("/v1/mfa/push/pairing/pair-1"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("offers a new code once the code has expired", async () => {
    pairingExpires = new Date(Date.now() - 1000).toISOString();
    wrap(<LinkPhoneDialog open onOpenChange={() => {}} />);
    const again = await screen.findByRole("button", { name: /get a new code/i });
    expect(screen.queryByTestId("pairing-code")).toBeNull();
    pairingExpires = new Date(Date.now() + 5 * 60_000).toISOString();
    fireEvent.click(again);
    expect(await screen.findByTestId("pairing-code")).toBeTruthy();
    expect(calls.filter((c) => c.path === "/v1/mfa/push/pairing").length).toBe(2);
  });

  it("closes without an error when the step-up is cancelled", async () => {
    startError = new ApiError(403, "step_up_required", "Confirm it's you");
    const onOpenChange = vi.fn();
    wrap(<LinkPhoneDialog open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
