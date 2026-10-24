// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, assert, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));

import { api } from "@/platform/api/client";
import type { PublicSession } from "@/platform/auth/server-session";
import { sessionStore } from "@/platform/auth/session-store";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import type { SecuritySummary } from "../api/user360";
import type { UserStats } from "../api/users";
import { DangerZone } from "../components/danger-zone";
import { SaveView, type UsersViewState } from "../components/filter-extras";
import { SecurityPosture } from "../components/posture-tiles";
import { UsersKpis } from "../components/users-kpis";

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

function stats(overrides: Partial<UserStats> = {}): UserStats {
  return {
    total: 200,
    active: 150,
    suspended: 10,
    invited: 40,
    mfa_enabled: 120,
    mfa_missing: 80,
    new_last_30d: 40,
    ...overrides,
  };
}

function card(name: RegExp): string {
  return screen.getByRole("button", { name }).textContent ?? "";
}

describe("UsersKpis", () => {
  it("shows each count with its share of the total, and 30-day growth on Total", () => {
    render(<UsersKpis stats={stats()} loading={false} onFilter={vi.fn()} />);

    // 40 new on a base of 160 → 25%.
    expect(card(/Total users/)).toContain("200");
    expect(card(/Total users/)).toContain("25% vs last 30 days");
    expect(card(/Active users/)).toContain("75% of total");
    expect(card(/MFA enabled/)).toContain("60% of total");
    expect(card(/MFA missing/)).toContain("40% of total");
    expect(card(/Suspended/)).toContain("5% of total");
  });

  it("rounds shares to one decimal place", () => {
    render(
      <UsersKpis
        stats={stats({ total: 3, active: 1, mfa_enabled: 2, mfa_missing: 1, suspended: 0 })}
        loading={false}
        onFilter={vi.fn()}
      />,
    );

    expect(card(/Active users/)).toContain("33.3% of total");
    expect(card(/MFA enabled/)).toContain("66.7% of total");
    expect(card(/Suspended/)).toContain("0% of total");
  });

  it("reports no growth when every member is new, and 0% shares for an empty tenant", () => {
    const { unmount } = render(
      <UsersKpis stats={stats({ total: 5, new_last_30d: 5 })} loading={false} onFilter={vi.fn()} />,
    );
    expect(card(/Total users/)).toContain("0% vs last 30 days");
    unmount();

    render(
      <UsersKpis
        stats={{
          total: 0,
          active: 0,
          suspended: 0,
          invited: 0,
          mfa_enabled: 0,
          mfa_missing: 0,
          new_last_30d: 0,
        }}
        loading={false}
        onFilter={vi.fn()}
      />,
    );
    expect(card(/Active users/)).toContain("0% of total");
  });

  it("filters the table by the card that was clicked", () => {
    const onFilter = vi.fn();
    render(<UsersKpis stats={stats()} loading={false} onFilter={onFilter} />);

    fireEvent.click(screen.getByRole("button", { name: /Total users/ }));
    fireEvent.click(screen.getByRole("button", { name: /Active users/ }));
    fireEvent.click(screen.getByRole("button", { name: /MFA enabled/ }));
    fireEvent.click(screen.getByRole("button", { name: /MFA missing/ }));
    fireEvent.click(screen.getByRole("button", { name: /Suspended/ }));

    expect(onFilter.mock.calls).toEqual([
      ["all"],
      ["active"],
      ["mfa_enabled"],
      ["mfa_missing"],
      ["suspended"],
    ]);
  });

  it("renders no cards while loading or when there are no counts", () => {
    const { container, rerender } = render(<UsersKpis loading onFilter={vi.fn()} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(container.firstChild).not.toBeNull();

    rerender(<UsersKpis loading={false} onFilter={vi.fn()} />);
    expect(container.firstChild).toBeNull();
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

function session(userId: string, tenantId: string): PublicSession {
  return {
    isAuthenticated: true,
    expiresAt: "2030-01-01T00:00:00Z",
    sessionId: `session-${userId}`,
    userId,
    tenantId,
    version: 1,
    impersonationActor: null,
  };
}

const CURRENT: UsersViewState = {
  search: "asha",
  status: "active",
  role: "admin",
  mfa: "enabled",
  emailVerified: "verified",
};

const VIEWS_KEY = "qeetid.users.savedViews:user-1:tenant-a";

function openSaveView(onApply = vi.fn()) {
  render(<SaveView current={CURRENT} onApply={onApply} />);
  fireEvent.click(screen.getByRole("button", { name: "Save view" }));
  return onApply;
}

describe("SaveView", () => {
  beforeEach(() => {
    window.localStorage.clear();
    act(() => sessionStore.hydrate(session("user-1", "tenant-a")));
  });

  it("saves the current filters under a trimmed name for this person and tenant", async () => {
    openSaveView();
    expect(await screen.findByText("No saved views yet.")).toBeTruthy();

    const name = screen.getByPlaceholderText("View name");
    const save = screen.getByRole("button", { name: "Save" });
    fireEvent.change(name, { target: { value: "   " } });
    expect((save as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(name, { target: { value: "  Admins  " } });
    fireEvent.click(save);

    expect(screen.getByRole("button", { name: "Admins" })).toBeTruthy();
    expect((name as HTMLInputElement).value).toBe("");
    expect(JSON.parse(window.localStorage.getItem(VIEWS_KEY) ?? "null")).toEqual({
      Admins: CURRENT,
    });
  });

  it("saves on Enter and applies a saved view when it is picked", async () => {
    const onApply = openSaveView();
    const name = await screen.findByPlaceholderText("View name");

    fireEvent.change(name, { target: { value: "Admins" } });
    fireEvent.keyDown(name, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Admins" }));

    expect(onApply).toHaveBeenCalledWith(CURRENT);
  });

  it("removes a saved view", async () => {
    window.localStorage.setItem(VIEWS_KEY, JSON.stringify({ Admins: CURRENT, Viewers: CURRENT }));
    openSaveView();

    expect(await screen.findByRole("button", { name: "Admins" })).toBeTruthy();
    const [first] = screen.getAllByRole("button", { name: "Delete" });
    assert(first, "expected a delete button per saved view");
    fireEvent.click(first);

    expect(screen.queryByRole("button", { name: "Admins" })).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(VIEWS_KEY) ?? "null")).toEqual({
      Viewers: CURRENT,
    });
  });

  it("never shows views saved in another tenant", async () => {
    window.localStorage.setItem(
      "qeetid.users.savedViews:user-1:tenant-b",
      JSON.stringify({ "Other tenant": CURRENT }),
    );
    openSaveView();

    expect(await screen.findByText("No saved views yet.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Other tenant" })).toBeNull();
  });
});
