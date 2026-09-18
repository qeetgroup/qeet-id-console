// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/authentication", searchStr: "", hash: "" }),
  Link: ({
    to,
    children,
    ...props
  }: ComponentProps<"a"> & { to: string; children?: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

import { EMPTY_OVERVIEW } from "../api/analytics";
import {
  type AuthOverviewViewData,
  AuthenticationOverviewView,
} from "../components/authentication-overview";

afterEach(cleanup);

const ALL = { policy: true, connections: true, users: true, analytics: true, audit: true };
const settled = <T,>(data?: T) => ({ isPending: false, isError: false, data });

function fixture(over: Partial<AuthOverviewViewData> = {}): AuthOverviewViewData {
  return {
    tenantId: "t1",
    permissions: ALL,
    policy: settled({
      password_enabled: true,
      passkey_enabled: true,
      magic_link_enabled: true,
      otp_email_enabled: false,
      otp_sms_enabled: false,
      remember_device_enabled: true,
    } as AuthOverviewViewData["policy"]["data"]),
    social: settled([
      { provider: "google", enabled: true },
      { provider: "github", enabled: true },
    ] as AuthOverviewViewData["social"]["data"]),
    saml: settled([{ id: "s1" }] as AuthOverviewViewData["saml"]["data"]),
    samlIdp: settled([]),
    analytics: settled({
      ...EMPTY_OVERVIEW,
      generated_at: new Date().toISOString(),
      kpis: { ...EMPTY_OVERVIEW.kpis, mfa_adoption_pct: { value: 68, delta_pct: 12 } },
    }),
    userStats: settled({
      total: 100,
      active: 100,
      mfa_enabled: 68,
    } as AuthOverviewViewData["userStats"]["data"]),
    devices: settled({ devices: 248, users: 120 }),
    activity: { events: [], connecting: false },
    ...over,
  };
}

describe("AuthenticationOverviewView", () => {
  it("renders the five KPIs with live values", () => {
    render(<AuthenticationOverviewView data={fixture()} />);
    expect(screen.getByText("Sign-in methods")).toBeTruthy();
    expect(screen.getByText("Social providers")).toBeTruthy();
    expect(screen.getByText("SSO connections")).toBeTruthy();
    expect(screen.getByText("MFA coverage")).toBeTruthy();
    expect(screen.getByText("Registered devices")).toBeTruthy();
    expect(screen.getByText("248")).toBeTruthy();
    expect(screen.getByText("68%")).toBeTruthy();
  });

  it("shows the MFA trend as percentage points against 7 days, not 30", () => {
    render(<AuthenticationOverviewView data={fixture()} />);
    expect(screen.getByText("+12.0pp")).toBeTruthy();
    expect(screen.getByText("vs 7 days ago")).toBeTruthy();
    // The window is 7 days server-side, so the page must not claim 30.
    expect(screen.queryByText(/Last 30 days/)).toBeNull();
  });

  it("shows NO trend when MFA falls back to user stats", () => {
    // The guard for "arrows only where real": the fallback has no history, so
    // an arrow here would be indistinguishable from the genuine one above.
    render(<AuthenticationOverviewView data={fixture({ analytics: settled(EMPTY_OVERVIEW) })} />);
    expect(screen.getByText("68%")).toBeTruthy();
    expect(screen.queryByText(/pp$/)).toBeNull();
    expect(screen.queryByText("vs 7 days ago")).toBeNull();
  });

  it("renders em-dashes while loading rather than zeroes", () => {
    const pending = { isPending: true, isError: false, data: undefined };
    render(
      <AuthenticationOverviewView
        data={fixture({ policy: pending, social: pending, devices: pending })}
      />,
    );
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });

  it("says unavailable on error instead of showing a zero", () => {
    render(
      <AuthenticationOverviewView
        data={fixture({ devices: { isPending: false, isError: true, data: undefined } })}
      />,
    );
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
  });

  it("hides connection-gated cards rather than zeroing them", () => {
    render(
      <AuthenticationOverviewView
        data={fixture({ permissions: { ...ALL, connections: false } })}
      />,
    );
    expect(screen.queryByText("Social providers")).toBeNull();
    expect(screen.queryByText("SSO connections")).toBeNull();
    expect(screen.queryByText("Registered devices")).toBeNull();
    // Sign-in and MFA are not connection-gated, so they stay.
    expect(screen.getByText("Sign-in methods")).toBeTruthy();
    expect(screen.getByText("MFA coverage")).toBeTruthy();
  });

  it("hides the activity panel without audit.read", () => {
    render(
      <AuthenticationOverviewView data={fixture({ permissions: { ...ALL, audit: false } })} />,
    );
    expect(screen.queryByText("Recent activity")).toBeNull();
  });

  it("lists every unmet item as a recommended action, badge in step", () => {
    const greenfield = fixture({
      policy: settled({
        password_enabled: true,
        passkey_enabled: false,
        magic_link_enabled: false,
        otp_email_enabled: false,
        otp_sms_enabled: false,
        remember_device_enabled: false,
      } as AuthOverviewViewData["policy"]["data"]),
      social: settled([]),
      saml: settled([]),
      samlIdp: settled([]),
      analytics: settled(EMPTY_OVERVIEW),
      userStats: settled({
        total: 100,
        active: 100,
        mfa_enabled: 0,
      } as AuthOverviewViewData["userStats"]["data"]),
      devices: settled({ devices: 0, users: 0 }),
    });
    render(<AuthenticationOverviewView data={greenfield} />);
    expect(screen.getByText("5 pending")).toBeTruthy();
    expect(screen.getByText("At risk")).toBeTruthy();
    expect(screen.getByText("No trusted devices yet")).toBeTruthy();
  });

  it("shows the actor name and time on activity rows", () => {
    render(
      <AuthenticationOverviewView
        data={fixture({
          activity: {
            connecting: false,
            events: [
              {
                id: "e1",
                title: "Google provider enabled",
                at: new Date().toISOString(),
                actor: { id: "u1", name: "Alex Chen", type: "user" },
              } as AuthOverviewViewData["activity"]["events"][number],
            ],
          },
        })}
      />,
    );
    expect(screen.getByText("Google provider enabled")).toBeTruthy();
    expect(screen.getByText("Alex Chen")).toBeTruthy();
  });
});
