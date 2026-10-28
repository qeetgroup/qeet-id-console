// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "tenant-1" }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
const can = vi.hoisted(() => ({ write: true }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({
    state: "ready",
    can: (c?: string) => (c === "policy.write" ? can.write : true),
  }),
}));
vi.mock("@/modules/dashboard", async () =>
  (await import("@/modules/authentication/components/methods/__tests__/stubs")).dashboardStub([
    { method: "password", value: 29.12 },
  ]),
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
import { Route } from "./password";

const PasswordPage = Route.options.component as () => React.JSX.Element;
const POLICY_PATH = "/v1/tenants/tenant-1/auth-policy";

// The policy as the API returns it: the tenant has not set its own lockout, so the three settings
// are null (the platform defaults), and the read-only limits document the defaults and bounds.
function storedPolicy(patch: Record<string, unknown> = {}) {
  return {
    password_enabled: true,
    password_min_length: 12,
    password_require_uppercase: true,
    password_require_number: true,
    password_require_symbol: false,
    magic_link_enabled: true,
    magic_link_ttl_minutes: 30,
    passkey_enabled: true,
    otp_email_enabled: false,
    otp_sms_enabled: false,
    self_registration_enabled: true,
    remember_device_enabled: true,
    remember_device_days: 30,
    lockout_threshold: null,
    lockout_window_minutes: null,
    lockout_duration_minutes: null,
    ...patch,
    lockout_limits: {
      defaults: { threshold: 5, window_minutes: 15, duration_minutes: 15 },
      min: { threshold: 3, window_minutes: 1, duration_minutes: 1 },
      max: { threshold: 20, window_minutes: 1440, duration_minutes: 1440 },
    },
  };
}

let stored: ReturnType<typeof storedPolicy>;
let saved: Record<string, unknown> | undefined;

beforeEach(() => {
  stored = storedPolicy();
  saved = undefined;
  can.write = true;
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === POLICY_PATH && (options?.method ?? "GET") === "GET") return stored;
    if (path === POLICY_PATH && options?.method === "PUT") {
      saved = options.body as Record<string, unknown>;
      return { ...stored, ...saved };
    }
    if (path === "/v1/tenants/tenant-1/policy") return { mfa_enforcement: "optional" };
    if (path === "/v1/users/stats") return { total: 45, mfa_enabled: 18 };
    throw new Error(`Unexpected request ${options?.method ?? "GET"} ${path}`);
  });
});

afterEach(cleanup);

const section = async (name: string) =>
  (await screen.findByRole("heading", { name })).closest("section") as HTMLElement;

describe("Sign-in › Password", () => {
  it("says whether password sign-in is on and how much it's used", async () => {
    renderPage(<PasswordPage />);
    const on = await section("Password sign-in");
    expect(within(on).getByText("On")).toBeTruthy();
    expect(within(on).getByText(/used for 29% of sign-ins in the last 30 days/i)).toBeTruthy();
  });

  it("confirms turning it off with what happens to people, then saves the whole policy", async () => {
    renderPage(<PasswordPage />);
    const on = await section("Password sign-in");
    fireEvent.click(within(on).getByRole("button", { name: "Turn off Password sign-in" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/their passwords are kept/i)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Turn off" }));
    await waitFor(() => expect(saved).toBeDefined());
    expect(saved).toMatchObject({ password_enabled: false, self_registration_enabled: true });
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "Change how people sign in" });
  });

  it("won't turn off the last way to sign in, and says why", async () => {
    stored = storedPolicy({ passkey_enabled: false, magic_link_enabled: false });
    renderPage(<PasswordPage />);
    const on = await section("Password sign-in");
    const button = within(on).getByRole("button", { name: "Turn off Password sign-in" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(within(on).getByText(/it's the only way to sign in that's on/i)).toBeTruthy();
  });

  it("states the rules as facts and changes the minimum length in place", async () => {
    renderPage(<PasswordPage />);
    const rules = await section("Rules for new passwords");
    expect(within(rules).getByText("12 characters")).toBeTruthy();
    expect(within(rules).getByText("An uppercase letter and a number")).toBeTruthy();
    expect(within(rules).getByText("A symbol isn't required.")).toBeTruthy();
    fireEvent.click(within(rules).getByRole("button", { name: "Edit the minimum length" }));
    fireEvent.change(within(rules).getByLabelText("Minimum length"), { target: { value: "14" } });
    fireEvent.click(within(rules).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saved).toMatchObject({ password_min_length: 14 }));
    expect(saved).toMatchObject({ password_require_uppercase: true, remember_device_days: 30 });
  });

  it("refuses a minimum length the server wouldn't keep", async () => {
    renderPage(<PasswordPage />);
    const rules = await section("Rules for new passwords");
    fireEvent.click(within(rules).getByRole("button", { name: "Edit the minimum length" }));
    fireEvent.change(within(rules).getByLabelText("Minimum length"), { target: { value: "200" } });
    fireEvent.click(within(rules).getByRole("button", { name: "Save" }));
    expect(await within(rules).findByText("Enter a length from 8 to 128.")).toBeTruthy();
    expect(saved).toBeUndefined();
  });

  it("changes which characters a password must hold", async () => {
    renderPage(<PasswordPage />);
    const rules = await section("Rules for new passwords");
    fireEvent.click(
      within(rules).getByRole("button", { name: "Edit what a password must include" }),
    );
    fireEvent.click(within(rules).getByRole("checkbox", { name: "A symbol" }));
    fireEvent.click(within(rules).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(saved).toMatchObject({
        password_require_uppercase: true,
        password_require_number: true,
        password_require_symbol: true,
      }),
    );
  });

  it("shows the lockout's platform defaults, and saves a change with the rest kept", async () => {
    renderPage(<PasswordPage />);
    const lockout = await section("Lockout after wrong passwords");
    expect(within(lockout).getAllByText("Default")).toHaveLength(3);
    fireEvent.click(within(lockout).getByRole("button", { name: "Edit the lockout" }));
    fireEvent.change(within(lockout).getByLabelText("Wrong passwords"), { target: { value: "3" } });
    fireEvent.click(within(lockout).getByRole("button", { name: "Save lockout" }));
    await waitFor(() => expect(saved).toBeDefined());
    expect(saved).toMatchObject({
      lockout_threshold: 3,
      lockout_window_minutes: null,
      lockout_duration_minutes: null,
      password_min_length: 12,
    });
  });

  it("doesn't save a lockout outside the allowed range", async () => {
    renderPage(<PasswordPage />);
    const lockout = await section("Lockout after wrong passwords");
    fireEvent.click(within(lockout).getByRole("button", { name: "Edit the lockout" }));
    fireEvent.change(within(lockout).getByLabelText("Wrong passwords"), { target: { value: "2" } });
    fireEvent.click(within(lockout).getByRole("button", { name: "Save lockout" }));
    expect(await within(lockout).findByText("Enter a number from 3 to 20.")).toBeTruthy();
    expect(saved).toBeUndefined();
  });

  it("points to Settings › Security for the two-step rule, with who has it", async () => {
    renderPage(<PasswordPage />);
    const twoStep = await section("Two-step verification");
    expect(await within(twoStep).findByText("Optional")).toBeTruthy();
    expect(within(twoStep).getByText(/18 of 45 people have turned it on/)).toBeTruthy();
    expect(
      within(twoStep).getByRole("link", { name: "See the 27 who haven't" }).getAttribute("href"),
    ).toBe("/users?twostep=off");
  });

  it("offers no changes to someone who can only read the policy", async () => {
    can.write = false;
    renderPage(<PasswordPage />);
    await section("Password sign-in");
    expect(screen.queryByRole("button", { name: /turn off|^edit/i })).toBeNull();
  });
});
