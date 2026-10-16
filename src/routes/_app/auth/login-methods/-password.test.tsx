// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "tenant-1" }));
vi.mock("@/platform/components/page-header", () => ({ PageHeader: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import { api } from "@/platform/api/client";
import { Route } from "./password";

const PasswordPage = Route.options.component as () => React.JSX.Element;
const POLICY_PATH = "/v1/tenants/tenant-1/auth-policy";

// The policy as the API returns it: the tenant has not set its own lockout,
// so the three settings are null (the platform defaults), and the read-only
// limits document the defaults and bounds.
function storedPolicy(lockout: Record<string, number | null> = {}) {
  return {
    password_enabled: true,
    password_min_length: 12,
    password_require_uppercase: true,
    password_require_number: false,
    password_require_symbol: false,
    magic_link_enabled: true,
    magic_link_ttl_minutes: 60,
    passkey_enabled: true,
    otp_email_enabled: false,
    otp_sms_enabled: false,
    self_registration_enabled: true,
    remember_device_enabled: false,
    lockout_threshold: null,
    lockout_window_minutes: null,
    lockout_duration_minutes: null,
    ...lockout,
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
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === POLICY_PATH && (options?.method ?? "GET") === "GET") return stored;
    if (path === POLICY_PATH && options?.method === "PUT") {
      saved = options.body as Record<string, unknown>;
      return { ...stored, ...saved };
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
      <PasswordPage />
    </QueryClientProvider>,
  );
}

const threshold = () => screen.findByLabelText(/failed attempts before locking/i);
const windowMinutes = () => screen.findByLabelText(/counting window/i);
const duration = () => screen.findByLabelText(/lock duration/i);

describe("Password settings — sign-in lockout", () => {
  it("shows the platform defaults and the allowed range for each setting", async () => {
    renderPage();
    expect(((await threshold()) as HTMLInputElement).placeholder).toBe("5");
    expect(((await windowMinutes()) as HTMLInputElement).placeholder).toBe("15");
    expect(((await duration()) as HTMLInputElement).placeholder).toBe("15");
    expect(screen.getByText(/between 3 and 20/i)).toBeTruthy();
  });

  it("saves the tenant's lockout with the rest of the policy unchanged", async () => {
    renderPage();
    fireEvent.change(await threshold(), { target: { value: "3" } });
    fireEvent.change(await windowMinutes(), { target: { value: "10" } });
    fireEvent.change(await duration(), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(saved).toBeDefined());
    expect(saved).toMatchObject({
      lockout_threshold: 3,
      lockout_window_minutes: 10,
      lockout_duration_minutes: 2,
      password_min_length: 12,
      self_registration_enabled: true,
    });
  });

  it("goes back to the platform default when a setting is cleared", async () => {
    stored = storedPolicy({ lockout_threshold: 4 });
    renderPage();
    const input = (await threshold()) as HTMLInputElement;
    expect(input.value).toBe("4");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(saved).toBeDefined());
    expect(saved?.lockout_threshold).toBeNull();
  });

  it("does not save a value outside the allowed range", async () => {
    renderPage();
    fireEvent.change(await threshold(), { target: { value: "2" } });
    expect(await screen.findByText(/must be between 3 and 20/i)).toBeTruthy();
    const save = screen.getByRole("button", { name: /save/i }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(save);
    expect(saved).toBeUndefined();
  });
});
