// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, assert, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import type { SecuritySummary } from "../api/user360";
import { DangerZone } from "../components/danger-zone";
import { SecurityPosture } from "../components/posture-tiles";

beforeEach(() => {
  navigate.mockReset();
  vi.mocked(api).mockReset();
  vi.mocked(api).mockResolvedValue(undefined);
});

afterEach(cleanup);

function security(overrides: Partial<SecuritySummary> = {}): SecuritySummary {
  return {
    mfa_required: false,
    mfa_enabled: true,
    totp_enabled: true,
    otp_factors: 2,
    push_devices: 1,
    passkeys: 1,
    passkey_last_used_at: null,
    recovery_codes_remaining: 8,
    password_set: true,
    password_changed_at: null,
    active_sessions: 1,
    distinct_devices: 1,
    ...overrides,
  };
}

/** Returns a tile's whole text: its label, value and sub-line. */
function tile(label: string): string {
  const root = screen.getByText(label, { exact: true }).parentElement?.parentElement;
  assert(root, `expected a "${label}" tile`);
  return root.textContent ?? "";
}

describe("SecurityPosture", () => {
  it("summarises a well-protected account", () => {
    render(
      <SecurityPosture
        email="asha@example.test"
        emailVerified
        security={security()}
        securityLoading={false}
        risk={{ level: "low", openCount: 0 }}
        riskLoading={false}
      />,
    );

    expect(tile("Email")).toBe("EmailVerifiedasha@example.test");
    expect(tile("MFA")).toBe("MFAEnabledAuthenticator · 2 OTP · 1 push");
    expect(tile("Passkeys")).toBe("Passkeys1 registeredNever used");
    expect(tile("Password")).toBe("PasswordEnabledChange date unknown");
    expect(tile("Sessions")).toBe("Sessions1 activeAcross 1 device");
    expect(tile("Risk level")).toBe("Risk levelLowNo suspicious activity");
  });

  it("flags the gaps of an unprotected account", () => {
    render(
      <SecurityPosture
        email="asha@example.test"
        emailVerified={false}
        security={security({
          mfa_enabled: false,
          mfa_required: true,
          totp_enabled: false,
          otp_factors: 0,
          push_devices: 0,
          passkeys: 0,
          password_set: false,
          active_sessions: 2,
          distinct_devices: 3,
        })}
        securityLoading={false}
        risk={{ level: "high", openCount: 2 }}
        riskLoading={false}
      />,
    );

    expect(tile("Email")).toContain("Unverified");
    expect(tile("MFA")).toBe("MFADisabledRequired — not enrolled");
    expect(tile("Passkeys")).toBe("Passkeys0 registeredNone registered");
    expect(tile("Password")).toBe("PasswordNot setPassword login not set up");
    expect(tile("Sessions")).toBe("Sessions2 activeAcross 3 devices");
    expect(tile("Risk level")).toBe("Risk levelHigh2 open signals");
  });

  it("distinguishes 'no MFA configured' from 'required but not enrolled'", () => {
    render(
      <SecurityPosture
        email="asha@example.test"
        emailVerified
        security={security({
          mfa_enabled: false,
          totp_enabled: false,
          otp_factors: 0,
          push_devices: 0,
        })}
        securityLoading={false}
        risk={{ level: "medium", openCount: 1 }}
        riskLoading={false}
      />,
    );

    expect(tile("MFA")).toBe("MFADisabledNo MFA configured");
    expect(tile("Risk level")).toBe("Risk levelMedium1 open signal");
  });

  it("says when a passkey was last used and the password last changed", () => {
    render(
      <SecurityPosture
        email="asha@example.test"
        emailVerified
        security={security({
          passkeys: 3,
          passkey_last_used_at: "2026-10-01T10:00:00Z",
          password_changed_at: "2026-09-01T10:00:00Z",
        })}
        securityLoading={false}
        riskLoading={false}
      />,
    );

    expect(tile("Passkeys")).toMatch(/^Passkeys3 registeredLast used /);
    expect(tile("Password")).toMatch(/^PasswordEnabledLast changed /);
    // No risk computed yet: a placeholder, not a guess.
    expect(tile("Risk level")).toBe("Risk level—No suspicious activity");
  });

  it("shows no posture values while the summary loads, but still shows the email", () => {
    render(<SecurityPosture email="asha@example.test" emailVerified securityLoading riskLoading />);

    expect(tile("Email")).toBe("EmailVerifiedasha@example.test");
    for (const label of ["MFA", "Passkeys", "Password", "Sessions", "Risk level"]) {
      expect(tile(label)).toBe(label);
    }
  });
});

function renderDangerZone(suspended: boolean) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <DangerZone userId="user-1" email="asha@example.test" suspended={suspended} />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

describe("DangerZone", () => {
  it("reactivates a suspended user straight away, without a confirmation", async () => {
    renderDangerZone(true);
    expect(screen.queryByRole("button", { name: "Suspend user" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reactivate user" }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/v1/users/user-1", {
        method: "PATCH",
        body: { status: "active" },
      }),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("suspends an active user only after the admin confirms", async () => {
    renderDangerZone(false);

    fireEvent.click(screen.getByRole("button", { name: "Suspend user" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Suspend this user?");
    expect(api).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Suspend user" }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/v1/users/user-1", {
        method: "PATCH",
        body: { status: "suspended" },
      }),
    );
  });

  it("revokes every session only after the admin confirms", async () => {
    renderDangerZone(false);

    fireEvent.click(screen.getByRole("button", { name: "Revoke all sessions" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(api).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke all" }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/v1/users/user-1/sessions/revoke-all", {
        method: "POST",
      }),
    );
  });

  it("names the user in the delete confirmation, deletes, then returns to the users list", async () => {
    renderDangerZone(false);

    fireEvent.click(screen.getByRole("button", { name: "Delete user" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Delete this user?");
    expect(dialog.textContent).toContain("asha@example.test");

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete user" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/users" }));
    expect(api).toHaveBeenCalledWith("/v1/users/user-1", { method: "DELETE" });
  });

  it("changes nothing and stays on the page when the deletion is cancelled", async () => {
    renderDangerZone(false);

    fireEvent.click(screen.getByRole("button", { name: "Delete user" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(api).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
