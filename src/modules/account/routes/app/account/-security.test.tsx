// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", async () => {
  const { ApiError } = await import("@/platform/errors/api-error");
  return { api: vi.fn(), ApiError };
});
vi.mock("@/platform/auth/session", () => ({
  useMe: () => ({ data: { email: "ada@example.com" } }),
  useTenantId: () => "t-1",
  useUserId: () => "u-1",
}));
vi.mock("@simplewebauthn/browser", () => ({ startRegistration: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
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
// The page's other cards link elsewhere in the console; a plain anchor keeps
// their targets visible without a router.
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

import { startRegistration } from "@simplewebauthn/browser";
import type { Passkey } from "@/modules/authentication";
import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./security";

const SecurityPage = Route.options.component as () => React.JSX.Element;

const passkey: Passkey = {
  id: "pk1",
  user_id: "user-1",
  name: "Chrome on macOS",
  transports: ["internal"],
  created_at: "2026-10-01T10:00:00Z",
  last_used_at: null,
};

// What GET /v1/passkeys returns; enrollment_allowed is false when the user's
// organization has passkeys switched off.
let listed: { items: Passkey[]; enrollment_allowed: boolean };
let finishBodies: unknown[];
let identities: { id: string; provider: string; email: string; linked_at: string }[];
let deleted: string[];
let totpEnrolled: boolean;
let confirmBodies: unknown[];
let passwordBodies: unknown[];

beforeEach(() => {
  listed = { items: [passkey], enrollment_allowed: true };
  finishBodies = [];
  identities = [];
  deleted = [];
  totpEnrolled = false;
  confirmBodies = [];
  passwordBodies = [];
  sensitiveCalls.length = 0;
  vi.mocked(startRegistration).mockReset();
  vi.mocked(startRegistration).mockResolvedValue({ id: "cred-1" } as never);
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/passkeys" && method === "GET") return listed;
    if (path === "/v1/passkeys/register/begin" && method === "POST")
      return { session_id: "ceremony-1", publicKey: { challenge: "abc" } };
    if (path === "/v1/passkeys/register/finish" && method === "POST") {
      finishBodies.push(options?.body);
      return undefined;
    }
    if (path === "/v1/auth/password" && method === "GET") return { has_password: true };
    if (path === "/v1/auth/password" && method === "POST") {
      passwordBodies.push(options?.body);
      return undefined;
    }
    if (path === "/v1/mfa/totp" && method === "GET") return { enrolled: totpEnrolled };
    if (path === "/v1/mfa/totp/enroll/start" && method === "POST")
      return {
        secret: "JBSWY3DPEHPK3PXP",
        provisioning_url: "otpauth://totp/Qeet:ada?secret=JBSWY3DPEHPK3PXP",
      };
    if (path === "/v1/mfa/totp/enroll/confirm" && method === "POST") {
      confirmBodies.push(options?.body);
      return { recovery_codes: ["aaaa-1111", "bbbb-2222"] };
    }
    if (path === "/v1/mfa/recovery-codes")
      return { enrolled: totpEnrolled, total: 10, remaining: 8 };
    if (path === "/v1/mfa/otp/factors" && method === "GET") return { items: [] };
    if (method === "DELETE") {
      deleted.push(path);
      return undefined;
    }
    if (path === "/v1/me/social/identities") return { items: identities };
    if (path === "/v1/auth/sign-in-methods")
      return { password: true, passkeys: 1, linked_identities: identities.length, total: 3 };
    if (path === "/v1/social/platform/providers") return { providers: ["google"] };
    if (path === "/v1/auth/trusted-devices") return { items: [] };
    if (path === "/v1/mfa/push/devices") return { items: [] };
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
        <SecurityPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

/** Pastes a code into the first of the six slots, as from the app. */
function pasteCode(code: string) {
  const first = screen.getAllByRole("textbox", {
    name: /code from the app/i,
  })[0] as HTMLInputElement;
  fireEvent.paste(first, { clipboardData: { getData: () => code } });
}

const addButton = () => screen.findByRole("button", { name: "Add a passkey" });

/** Opens the add-a-passkey form, then asks the browser for one. */
async function addPasskey(name?: string) {
  fireEvent.click(await addButton());
  if (name !== undefined) {
    fireEvent.change(await screen.findByRole("textbox", { name: /^name/i }), {
      target: { value: name },
    });
  }
  fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
}

describe("Account › Security: two-step verification", () => {
  it("sets up an authenticator app: the key to type, a code from the app, then the recovery codes", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Set up" }));

    // Its key in groups of four, as apps print it, beside the QR code.
    expect(await screen.findByText("JBSW Y3DP EHPK 3PXP")).toBeTruthy();
    expect(sensitiveCalls.at(-1)?.confirm).toBeUndefined();
    pasteCode("123456");
    fireEvent.click(screen.getByRole("button", { name: "Turn on" }));

    await waitFor(() => expect(confirmBodies).toEqual([{ code: "123456" }]));
    expect(await screen.findByText("aaaa-1111")).toBeTruthy();
    // Closing waits until the person says the codes are saved.
    const done = screen.getByRole("button", { name: "Done" });
    expect(done.getAttribute("aria-disabled") ?? done.getAttribute("disabled")).not.toBeNull();
  });

  it("asks before replacing a working app, which keeps working until the new one is confirmed", async () => {
    totpEnrolled = true;
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Replace" }));
    const title = await screen.findByText("Replace your authenticator app?");
    const dialog = title.closest('[role="dialog"], [role="alertdialog"]') as HTMLElement;
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByText("Replace your authenticator app?")).toBeNull());
    const posts = vi.mocked(api).mock.calls.filter(([, options]) => options?.method === "POST");
    expect(posts).toEqual([]);
  });

  it("asks before turning the app off", async () => {
    totpEnrolled = true;
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Turn off" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Turn off the authenticator app?")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Turn off" }));

    await waitFor(() => expect(deleted).toEqual(["/v1/mfa/totp"]));
  });
});

describe("Account › Security: passkeys", () => {
  it("lists the user's passkeys and offers adding one right there, not through an admin screen", async () => {
    renderPage();
    expect(await screen.findByText("Chrome on macOS")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Rename Chrome on macOS" })).toBeTruthy();
    expect(await addButton()).toBeTruthy();
    const adminLinks = screen
      .queryAllByRole("link")
      .filter((a) => a.getAttribute("href")?.startsWith("/auth/"));
    expect(adminLinks).toEqual([]);
  });

  it("adds a passkey without a name, so the server names it after the browser", async () => {
    renderPage();
    await addPasskey();
    await waitFor(() => expect(finishBodies).toHaveLength(1));
    expect(finishBodies[0]).toEqual({ session_id: "ceremony-1", credential: { id: "cred-1" } });
    expect(startRegistration).toHaveBeenCalledWith({ optionsJSON: { challenge: "abc" } });
    // Adding one is step-up gated: it runs as a sensitive action, without a confirmation.
    expect(sensitiveCalls).toEqual([expect.objectContaining({ actionLabel: "Add a passkey" })]);
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("adds a passkey with the name the user typed, trimmed", async () => {
    renderPage();
    await addPasskey("  Work laptop  ");
    await waitFor(() => expect(finishBodies).toHaveLength(1));
    expect(finishBodies[0]).toMatchObject({ name: "Work laptop" });
  });

  it("says so calmly when the browser prompt is dismissed", async () => {
    vi.mocked(startRegistration).mockRejectedValue(
      Object.assign(new Error("The operation either timed out or was not allowed."), {
        name: "NotAllowedError",
      }),
    );
    renderPage();
    await addPasskey();
    expect(await screen.findByText("The passkey wasn't created. You can try again.")).toBeTruthy();
    expect(finishBodies).toHaveLength(0);
  });

  it("does not offer adding a passkey when the organisation has passkeys switched off", async () => {
    listed = { items: [], enrollment_allowed: false };
    renderPage();
    expect(
      await screen.findByText("Your organisation has turned off passkeys, so you can't add one."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add a passkey" })).toBeNull();
  });
});

describe("Account › Security: removing a passkey", () => {
  it("asks for confirmation before removing it", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Remove Chrome on macOS" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText('Remove the passkey "Chrome on macOS"?')).toBeTruthy();
    expect(deleted).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: /^remove$/i }));
    await waitFor(() => expect(deleted).toEqual(["/v1/passkeys/pk1"]));
    expect(sensitiveCalls.at(-1)?.actionLabel).toBe("Remove a passkey");
  });

  it("keeps it when the confirmation is cancelled", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Remove Chrome on macOS" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(deleted).toEqual([]);
  });
});

describe("Account › Security: password", () => {
  it("asks for the current password and at least 8 characters before changing it", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Change" }));
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("Enter your current password.")).toBeTruthy();
    expect(screen.getByText("Use at least 8 characters.")).toBeTruthy();
    expect(passwordBodies).toEqual([]);

    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "old-one" } });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "a-longer-one" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    await waitFor(() =>
      expect(passwordBodies).toEqual([
        { current_password: "old-one", new_password: "a-longer-one" },
      ]),
    );
  });
});

describe("Account › Security: disconnecting a connected account", () => {
  beforeEach(() => {
    identities = [
      { id: "id-1", provider: "google", email: "ada@example.com", linked_at: "2026-10-01" },
    ];
  });

  it("asks for confirmation before disconnecting, since it removes a way to sign in", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Disconnect Google" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Disconnect Google?")).toBeTruthy();
    expect(deleted).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(deleted).toEqual(["/v1/me/social/identities/id-1"]));
    expect(sensitiveCalls.at(-1)?.actionLabel).toBe("Disconnect");
  });

  it("keeps the account connected when the confirmation is cancelled", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Disconnect Google" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(deleted).toEqual([]);
  });
});
