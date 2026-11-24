// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ organizationId: "org-a" as string | null, userId: "user-1" }));

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({
  useOrganizationId: () => session.organizationId,
  useUserId: () => session.userId,
}));
vi.mock("@/modules/authentication", () => ({ switchToOrganization: vi.fn(async () => undefined) }));
vi.mock("../load-page", () => ({ loadPage: vi.fn() }));

import { switchToOrganization } from "@/modules/authentication";
import { api } from "@/platform/api/client";
import { readPendingOnboarding, stashOnboardingProfile } from "../onboarding-profile";
import { loadPage } from "../load-page";
import { type CheckoutParams, useCheckoutReturn } from "../use-checkout-return";

const PROFILE = { use_case: "b2b_saas", team_size: "2-10", role: "engineer" };

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(api).mockReset();
  vi.mocked(switchToOrganization).mockClear();
  vi.mocked(loadPage).mockClear();
  session.organizationId = "org-a";
  session.userId = "user-1";
});

afterEach(() => {
  vi.useRealTimers();
});

describe("readPendingOnboarding", () => {
  it("returns the stash only to the person who entered it", () => {
    stashOnboardingProfile({ profile: PROFILE, slug: "new-org", userId: "user-1" });

    expect(readPendingOnboarding("user-1")).toMatchObject({ profile: PROFILE, slug: "new-org" });
    expect(readPendingOnboarding("user-2")).toBeNull();
  });

  it("drops a stash older than a day", () => {
    vi.useFakeTimers({ now: new Date("2026-10-01T00:00:00Z") });
    stashOnboardingProfile({ profile: PROFILE, slug: "new-org", userId: "user-1" });
    vi.setSystemTime(new Date("2026-10-02T00:00:01Z"));

    expect(readPendingOnboarding("user-1")).toBeNull();
    expect(localStorage.length).toBe(0);
  });
});

describe("useCheckoutReturn", () => {
  const existing = [
    { id: "org-a", slug: "org-a-slug" },
    { id: "org-b", slug: "org-b-slug" }, // another organization of the same person
  ];
  const clear = vi.fn();
  const returning = (params: CheckoutParams) =>
    renderHook(() => useCheckoutReturn(params, clear), { wrapper });

  beforeEach(() => clear.mockClear());

  it("finishes in the paid organization, not another existing one", async () => {
    stashOnboardingProfile({ profile: PROFILE, slug: "new-org", userId: "user-1" });
    vi.mocked(api)
      .mockResolvedValueOnce({ items: existing })
      .mockResolvedValue({ items: [...existing, { id: "org-new", slug: "new-org" }] });

    const { result } = returning({ checkout: "success" });

    expect(result.current.state).toBe("finishing");
    expect(clear).toHaveBeenCalledOnce();
    await waitFor(() => expect(switchToOrganization).toHaveBeenCalledWith("org-new"), {
      timeout: 3000,
    });
    expect(switchToOrganization).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith("/v1/organizations", { query: { limit: 200 } });
  });

  it("without a stash, waits for an organization that wasn't there before", async () => {
    vi.mocked(api)
      .mockResolvedValueOnce({ items: existing })
      .mockResolvedValue({ items: [...existing, { id: "org-new", slug: "new-org" }] });

    returning({ checkout: "success" });

    await waitFor(() => expect(switchToOrganization).toHaveBeenCalledWith("org-new"), {
      timeout: 3000,
    });
    expect(switchToOrganization).not.toHaveBeenCalledWith("org-b");
  });

  it("opens the console when the session is already in the paid organization", async () => {
    stashOnboardingProfile({ profile: PROFILE, slug: "org-a-slug", userId: "user-1" });
    vi.mocked(api).mockResolvedValue({ items: existing });
    returning({ checkout: "success" });
    await waitFor(() => expect(loadPage).toHaveBeenCalledWith("/"));
    expect(switchToOrganization).not.toHaveBeenCalled();
  });

  it("on a cancelled payment, gives back what was entered and creates nothing", () => {
    const draft = {
      name: "Acme",
      region: "ap-south-1",
      tier: "pro",
      cycle: "year",
      currency: "INR",
    } as const;
    stashOnboardingProfile({ profile: PROFILE, slug: "acme", userId: "user-1", draft });
    const { result } = returning({ checkout: "cancelled" });
    expect(result.current).toMatchObject({ state: "cancelled", pending: { slug: "acme", draft } });
    expect(api).not.toHaveBeenCalled();
  });

  it("reads an unpaid Razorpay link as cancelled, and verifies a paid one first", async () => {
    const unpaid = returning({
      razorpay_payment_link_id: "plink_1",
      razorpay_payment_link_status: "cancelled",
    });
    expect(unpaid.result.current.state).toBe("cancelled");
    unpaid.unmount();

    vi.mocked(api).mockResolvedValue({ items: [...existing, { id: "org-new", slug: "new-org" }] });
    stashOnboardingProfile({ profile: PROFILE, slug: "new-org", userId: "user-1" });
    // Razorpay's redirect carries all five signed fields.
    returning({
      razorpay_payment_id: "pay_2",
      razorpay_payment_link_id: "plink_2",
      razorpay_payment_link_reference_id: "ref_2",
      razorpay_payment_link_status: "paid",
      razorpay_signature: "sig",
    });
    await waitFor(() => expect(switchToOrganization).toHaveBeenCalledWith("org-new"));
    expect(api).toHaveBeenCalledWith("/v1/billing/razorpay/verify", {
      method: "POST",
      body: {
        razorpay_payment_id: "pay_2",
        razorpay_payment_link_id: "plink_2",
        razorpay_payment_link_reference_id: "ref_2",
        razorpay_payment_link_status: "paid",
        razorpay_signature: "sig",
      },
    });
  });

  it("sends no verification without the signed fields, and still waits for the organisation", async () => {
    vi.mocked(api).mockResolvedValue({ items: [...existing, { id: "org-new", slug: "new-org" }] });
    stashOnboardingProfile({ profile: PROFILE, slug: "new-org", userId: "user-1" });
    returning({ razorpay_payment_link_id: "plink_3", razorpay_payment_link_status: "paid" });
    await waitFor(() => expect(switchToOrganization).toHaveBeenCalledWith("org-new"));
    expect(api).not.toHaveBeenCalledWith("/v1/billing/razorpay/verify", expect.anything());
  });

  it("says when it is taking long, and checks again on request", async () => {
    vi.useFakeTimers();
    stashOnboardingProfile({ profile: PROFILE, slug: "new-org", userId: "user-1" });
    vi.mocked(api).mockResolvedValue({ items: existing });
    const { result } = returning({ checkout: "success" });
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(result.current.state).toBe("slow");
    vi.mocked(api).mockResolvedValue({ items: [...existing, { id: "org-new", slug: "new-org" }] });
    act(() => (result.current as { checkAgain: () => void }).checkAgain());
    expect(result.current.state).toBe("finishing");
    await act(() => vi.advanceTimersByTimeAsync(10));
    expect(switchToOrganization).toHaveBeenCalledWith("org-new");
  });

  it("does nothing on a plain visit", () => {
    const { result } = returning({});
    expect(result.current.state).toBe("none");
    expect(clear).not.toHaveBeenCalled();
  });
});
