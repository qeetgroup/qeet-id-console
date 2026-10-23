// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ tenantId: "org-a" as string | null, userId: "user-1" }));

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({
  useTenantId: () => session.tenantId,
  useUserId: () => session.userId,
}));
vi.mock("@/modules/authentication", () => ({ switchToTenant: vi.fn(async () => undefined) }));
vi.mock("sonner", () => ({ toast: { message: vi.fn() } }));

import { switchToTenant } from "@/modules/authentication";
import { api } from "@/platform/api/client";
import { readPendingOnboarding, stashOnboardingProfile } from "../onboarding-profile";
import { useApplyOnboardingProfile } from "../use-apply-onboarding-profile";
import { useCheckoutReturn } from "../use-checkout-return";

const PROFILE = { use_case: "b2b_saas", team_size: "2-10", role: "engineer" };

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(api).mockReset();
  vi.mocked(switchToTenant).mockClear();
  session.tenantId = "org-a";
  session.userId = "user-1";
});

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState({}, "", "/");
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

describe("useApplyOnboardingProfile", () => {
  it("writes the profile to the organization it was entered for", async () => {
    stashOnboardingProfile({ profile: PROFILE, slug: "org-a-slug", userId: "user-1" });
    vi.mocked(api).mockResolvedValueOnce({ id: "org-a", slug: "org-a-slug", metadata: null });

    renderHook(() => useApplyOnboardingProfile(), { wrapper });

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/v1/tenants/org-a", {
        method: "PATCH",
        body: { metadata: { onboarding: PROFILE } },
      }),
    );
  });

  it("leaves another organization alone after an abandoned checkout", async () => {
    stashOnboardingProfile({ profile: PROFILE, slug: "never-paid", userId: "user-1" });
    vi.mocked(api).mockResolvedValueOnce({ id: "org-a", slug: "org-a-slug", metadata: null });

    renderHook(() => useApplyOnboardingProfile(), { wrapper });

    await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
    expect(api).not.toHaveBeenCalledWith(
      "/v1/tenants/org-a",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(readPendingOnboarding("user-1")).not.toBeNull();
  });
});

describe("useCheckoutReturn", () => {
  const existing = [
    { id: "org-a", slug: "org-a-slug" },
    { id: "org-b", slug: "org-b-slug" }, // another organization of the same person
  ];

  it("switches into the paid organization, not another existing one", async () => {
    window.history.replaceState({}, "", "/?checkout=success");
    stashOnboardingProfile({ profile: PROFILE, slug: "new-org", userId: "user-1" });
    vi.mocked(api)
      .mockResolvedValueOnce({ items: existing })
      .mockResolvedValue({ items: [...existing, { id: "org-new", slug: "new-org" }] });

    renderHook(() => useCheckoutReturn());

    await waitFor(() => expect(switchToTenant).toHaveBeenCalledWith("org-new"), { timeout: 3000 });
    expect(switchToTenant).toHaveBeenCalledTimes(1);
  });

  it("without a stash, waits for an organization that wasn't there before", async () => {
    window.history.replaceState({}, "", "/?checkout=success");
    vi.mocked(api)
      .mockResolvedValueOnce({ items: existing })
      .mockResolvedValue({ items: [...existing, { id: "org-new", slug: "new-org" }] });

    renderHook(() => useCheckoutReturn());

    await waitFor(() => expect(switchToTenant).toHaveBeenCalledWith("org-new"), { timeout: 3000 });
    expect(switchToTenant).not.toHaveBeenCalledWith("org-b");
  });
});
