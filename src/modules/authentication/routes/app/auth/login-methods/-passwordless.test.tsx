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
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
const can = vi.hoisted(() => ({ count: true }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({
    state: "ready",
    can: (c?: string) => (c === "connection.read" ? can.count : true),
  }),
}));
vi.mock("@/modules/dashboard", async () =>
  (await import("@/modules/authentication/components/methods/__tests__/stubs")).dashboardStub([
    { method: "passkey", value: 2.16 },
  ]),
);
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: (await import("@/modules/authentication/components/methods/__tests__/stubs")).RouterLink,
}));

import { renderPage } from "@/modules/authentication/components/methods/__tests__/kit";
import { api } from "@/platform/api/client";
import { Route } from "./passwordless";

const PasswordlessPage = Route.options.component as () => React.JSX.Element;
const POLICY_PATH = "/v1/tenants/tenant-1/auth-policy";
const POLICY = {
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
  self_registration_enabled: false,
  remember_device_enabled: true,
  remember_device_days: 30,
  lockout_threshold: null,
  lockout_window_minutes: null,
  lockout_duration_minutes: null,
};

let saved: Record<string, unknown> | undefined;

beforeEach(() => {
  saved = undefined;
  can.count = true;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === POLICY_PATH && (options?.method ?? "GET") === "GET") return POLICY;
    if (path === POLICY_PATH && options?.method === "PUT") {
      saved = options.body as Record<string, unknown>;
      return { ...POLICY, ...saved };
    }
    if (path === "/v1/auth/trusted-devices/count") return { devices: 5, users: 4 };
    throw new Error(`Unexpected request ${options?.method ?? "GET"} ${path}`);
  });
});

afterEach(cleanup);

const section = async (name: string) =>
  (await screen.findByRole("heading", { name })).closest("section") as HTMLElement;

describe("Sign-in › Passwordless", () => {
  it("shows passkeys with their use, and where people manage their own", async () => {
    renderPage(<PasswordlessPage />);
    const passkeys = await section("Passkeys");
    expect(within(passkeys).getByText("On")).toBeTruthy();
    expect(within(passkeys).getByText(/used for 2% of sign-ins/i)).toBeTruthy();
    expect(
      within(passkeys).getByRole("link", { name: "My account › Security" }).getAttribute("href"),
    ).toBe("/account/security");
  });

  it("no longer repeats the magic-link switch, which its own tab owns", async () => {
    renderPage(<PasswordlessPage />);
    await section("Passkeys");
    expect(screen.queryByRole("heading", { name: "Magic links" })).toBeNull();
  });

  it("confirms turning passkeys off with what happens to people", async () => {
    renderPage(<PasswordlessPage />);
    const passkeys = await section("Passkeys");
    fireEvent.click(within(passkeys).getByRole("button", { name: "Turn off Passkeys" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/the passkeys people have are kept/i)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Turn off" }));
    await waitFor(() => expect(saved).toMatchObject({ passkey_enabled: false }));
  });

  it("says how long a device is remembered and how many are, and changes the days", async () => {
    renderPage(<PasswordlessPage />);
    const remember = await section("Remembered devices");
    expect(within(remember).getByText("30 days")).toBeTruthy();
    expect(await within(remember).findByText("5 devices, for 4 people")).toBeTruthy();
    fireEvent.click(
      within(remember).getByRole("button", { name: "Edit how long a device is remembered" }),
    );
    fireEvent.change(within(remember).getByLabelText("Remembered for"), {
      target: { value: "14" },
    });
    fireEvent.click(within(remember).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saved).toMatchObject({ remember_device_days: 14 }));
  });

  it("refuses more than 90 days, as the server does", async () => {
    renderPage(<PasswordlessPage />);
    const remember = await section("Remembered devices");
    fireEvent.click(
      within(remember).getByRole("button", { name: "Edit how long a device is remembered" }),
    );
    fireEvent.change(within(remember).getByLabelText("Remembered for"), {
      target: { value: "120" },
    });
    fireEvent.click(within(remember).getByRole("button", { name: "Save" }));
    expect(await within(remember).findByText("Enter a number of days from 1 to 90.")).toBeTruthy();
    expect(saved).toBeUndefined();
  });

  it("leaves the count out for someone who can't read it", async () => {
    can.count = false;
    renderPage(<PasswordlessPage />);
    const remember = await section("Remembered devices");
    expect(within(remember).queryByText("Remembered now")).toBeNull();
  });
});
