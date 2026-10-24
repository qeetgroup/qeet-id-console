// @vitest-environment jsdom
// Each simulated tab hears its own activity on its own EventTarget; all of them share the one
// localStorage, as the tabs of one browser profile do.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("@/platform/api/client", () => ({ api: vi.fn(async () => undefined) }));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
}));

import { api } from "@/platform/api/client";
import { readSharedActivity, watchIdle } from "../idle-activity";
import { useIdleLogout } from "../session";

const KEY = "qeetid.last-activity";
const MINUTE = 60_000;
const LIMIT = 10 * MINUTE;
const START = new Date("2026-10-24T10:00:00Z").getTime();

const stops: (() => void)[] = [];

function openTab() {
  const target = new EventTarget();
  const onIdle = vi.fn();
  const stop = watchIdle({ timeoutMs: LIMIT, onIdle, target });
  stops.push(stop);
  return { onIdle, stop, work: () => target.dispatchEvent(new Event("mousemove")) };
}

function shared(): number | null {
  const value = window.localStorage.getItem(KEY);
  return value === null ? null : Number(value);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  window.localStorage.clear();
});

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("idle sign-out across tabs", () => {
  it("keeps a tab signed in while the operator works in another", () => {
    const working = openTab();
    const idle = openTab();

    for (let i = 0; i < 6; i++) {
      vi.advanceTimersByTime(4 * MINUTE);
      working.work();
    }

    expect(idle.onIdle).not.toHaveBeenCalled();
    expect(working.onIdle).not.toHaveBeenCalled();
  });

  it("signs out once every tab has been idle for the limit", () => {
    const first = openTab();
    const second = openTab();
    vi.advanceTimersByTime(3 * MINUTE);
    first.work();

    vi.advanceTimersByTime(LIMIT - 1);
    expect(second.onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(first.onIdle).toHaveBeenCalledOnce();
    expect(second.onIdle).toHaveBeenCalledOnce();

    // Signed out, a tab stops listening: later activity doesn't re-arm it.
    second.work();
    vi.advanceTimersByTime(3 * LIMIT);
    expect(first.onIdle).toHaveBeenCalledOnce();
    expect(second.onIdle).toHaveBeenCalledOnce();
  });

  it("honours a timestamp another tab wrote", () => {
    const tab = openTab();
    vi.advanceTimersByTime(9 * MINUTE);
    window.localStorage.setItem(KEY, String(Date.now()));

    vi.advanceTimersByTime(LIMIT - 1);
    expect(tab.onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(tab.onIdle).toHaveBeenCalledOnce();
  });

  it.each([
    ["unreadable", "soon"],
    ["in the future", String(START + 60 * MINUTE)],
  ])("ignores a timestamp that is %s", (_label, value) => {
    const tab = openTab();
    window.localStorage.setItem(KEY, value);

    vi.advanceTimersByTime(LIMIT);

    expect(tab.onIdle).toHaveBeenCalledOnce();
  });

  it("goes by its own activity when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    const tab = openTab();
    vi.advanceTimersByTime(5 * MINUTE);
    tab.work();

    vi.advanceTimersByTime(LIMIT - 1);
    expect(tab.onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(tab.onIdle).toHaveBeenCalledOnce();
  });
});

describe("shared activity timestamp", () => {
  it("records opening a tab as activity", () => {
    openTab();

    expect(shared()).toBe(START);
    expect(readSharedActivity(Date.now())).toBe(START);
  });

  it("writes at most every 15 seconds, the newest activity last", () => {
    const tab = openTab();
    vi.advanceTimersByTime(1_000);
    tab.work();
    vi.advanceTimersByTime(4_000);
    tab.work();
    expect(shared()).toBe(START);

    vi.advanceTimersByTime(10_000);

    expect(shared()).toBe(START + 5_000);
  });

  it("keeps a newer timestamp another tab wrote", () => {
    const tab = openTab();
    vi.advanceTimersByTime(1_000);
    tab.work();
    vi.advanceTimersByTime(9_000);
    window.localStorage.setItem(KEY, String(Date.now()));

    vi.advanceTimersByTime(5_000);

    expect(shared()).toBe(START + 10_000);
  });

  it("writes pending activity when the tab stops watching", () => {
    const tab = openTab();
    vi.advanceTimersByTime(2_000);
    tab.work();

    tab.stop();

    expect(shared()).toBe(START + 2_000);
  });

  it("holds nothing but a timestamp", () => {
    const tab = openTab();
    tab.work();

    expect(Object.keys(window.localStorage)).toEqual([KEY]);
    expect(window.localStorage.getItem(KEY)).toMatch(/^\d+$/);
  });
});

describe("useIdleLogout", () => {
  function wrapper({ children }: { children: ReactNode }) {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  it("signs out through the logout endpoint once the console is idle", async () => {
    const { unmount } = renderHook(() => useIdleLogout(LIMIT), { wrapper });

    await vi.advanceTimersByTimeAsync(LIMIT);

    expect(api).toHaveBeenCalledOnce();
    expect(api).toHaveBeenCalledWith("/v1/auth/logout", { method: "POST" });
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/sign-in" }));
    unmount();
  });

  it("stays signed in while another tab records activity", async () => {
    vi.mocked(api).mockClear();
    const { unmount } = renderHook(() => useIdleLogout(LIMIT), { wrapper });

    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(5 * MINUTE);
      window.localStorage.setItem(KEY, String(Date.now()));
    }

    expect(api).not.toHaveBeenCalled();
    unmount();
  });
});
