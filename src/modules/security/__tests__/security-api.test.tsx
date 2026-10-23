// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({ tenantId: "tenant-a" as string | null }));
vi.mock("@/platform/api/client", async () => {
  const { ApiError } = await import("@/platform/errors/api-error");
  return { api: vi.fn(), ApiError };
});
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => context.tenantId }));

import { api } from "@/platform/api/client";
import { ApiError } from "@/platform/errors/api-error";
import { useAnomalies, useAnomalySummary, useResolveAnomaly } from "../api/anomalies";
import {
  useAuditAnomalies,
  useAuditAnomalySettings,
  useAuditAnomalySummary,
  useResolveAuditAnomaly,
  useUpdateAuditAnomalySettings,
  useVerifyAuditChain,
} from "../api/audit-anomalies";
import {
  type BotSettings,
  useBotOverview,
  useBotSettings,
  useUpdateBotSettings,
} from "../api/bots";
import { useDeviceAuthorizations, useRevokeDeviceAuth } from "../api/device-auth";
import {
  useCreateLogSink,
  useDeleteLogSink,
  useLogSinks,
  useToggleLogSink,
} from "../api/log-sinks";
import { securityKeys } from "../api/keys";

/** Renders the hook; mutation tests seed the caches it may refresh, query tests start empty. */
function setup<T>(hook: () => T, seed: QueryKey[] = []) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  for (const key of seed) client.setQueryData(key, { seeded: true });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(hook, { wrapper }) };
}

function invalidated(client: QueryClient, key: QueryKey) {
  return client.getQueryState(key)?.isInvalidated === true;
}

beforeEach(() => {
  context.tenantId = "tenant-a";
  vi.mocked(api).mockReset();
  vi.mocked(api).mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("tenant-scoped reads", () => {
  it.each([
    [
      "security anomaly summary",
      useAnomalySummary,
      "/v1/tenants/tenant-b/security/anomalies/summary",
    ],
    [
      "audit anomaly summary",
      useAuditAnomalySummary,
      "/v1/tenants/tenant-b/audit/anomalies/summary",
    ],
    [
      "audit anomaly settings",
      useAuditAnomalySettings,
      "/v1/tenants/tenant-b/audit/anomaly-settings",
    ],
    ["bot settings", useBotSettings, "/v1/tenants/tenant-b/security/bots/settings"],
    ["log sinks", useLogSinks, "/v1/tenants/tenant-b/log-sinks"],
    ["device authorizations", useDeviceAuthorizations, "/v1/tenants/tenant-b/oauth/devices"],
  ] as const)("reads the current tenant's %s", async (_name, useHook, path) => {
    context.tenantId = "tenant-b";
    vi.mocked(api).mockResolvedValue({ from: path });
    const { result } = setup(() => useHook());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith(path);
    expect(result.current.data).toEqual({ from: path });
  });

  it.each([
    ["security anomalies", useAnomalies],
    ["security anomaly summary", useAnomalySummary],
    ["audit anomalies", useAuditAnomalies],
    ["audit anomaly summary", useAuditAnomalySummary],
    ["audit anomaly settings", useAuditAnomalySettings],
    ["bot overview", useBotOverview],
    ["bot settings", useBotSettings],
    ["log sinks", useLogSinks],
    ["device authorizations", useDeviceAuthorizations],
  ] as const)("does not read %s before a tenant is selected", (_name, useHook) => {
    context.tenantId = null;
    expect(setup(() => useHook()).result.current.fetchStatus).toBe("idle");
    expect(api).not.toHaveBeenCalled();
  });
});

describe("tenant-scoped changes", () => {
  it("refuses every change before a tenant is selected, sending nothing", async () => {
    context.tenantId = null;
    const settings: BotSettings = {
      ua_check: true,
      honeypot: false,
      captcha: false,
      signature: false,
      score_threshold: 0.7,
    };
    const { result } = setup(() => ({
      resolveAnomaly: useResolveAnomaly(),
      resolveAuditAnomaly: useResolveAuditAnomaly(),
      updateAuditSettings: useUpdateAuditAnomalySettings(),
      verifyAuditChain: useVerifyAuditChain(),
      updateBotSettings: useUpdateBotSettings(),
      createLogSink: useCreateLogSink(),
      toggleLogSink: useToggleLogSink(),
      deleteLogSink: useDeleteLogSink(),
      revokeDevice: useRevokeDeviceAuth(),
    }));
    const m = result.current;

    await act(async () => {
      const outcomes = await Promise.allSettled([
        m.resolveAnomaly.mutateAsync("an-1"),
        m.resolveAuditAnomaly.mutateAsync("aa-1"),
        m.updateAuditSettings.mutateAsync({
          enabled: true,
          score_threshold: 0.8,
          min_baseline_events: 50,
        }),
        m.verifyAuditChain.mutateAsync(),
        m.updateBotSettings.mutateAsync(settings),
        m.createLogSink.mutateAsync({ type: "http", endpoint: "https://x.test", token: "t" }),
        m.toggleLogSink.mutateAsync({ id: "sink-1", enabled: false }),
        m.deleteLogSink.mutateAsync("sink-1"),
        m.revokeDevice.mutateAsync("dev-1"),
      ]);
      for (const outcome of outcomes) {
        expect(outcome).toMatchObject({
          status: "rejected",
          reason: new Error("No tenant selected"),
        });
      }
    });

    expect(api).not.toHaveBeenCalled();
  });
});

describe("useAnomalies", () => {
  it("reads the tenant's security anomalies", async () => {
    const items = [
      {
        id: "an-1",
        type: "credential_stuffing",
        severity: "high",
        detail: "Many failed sign-ins",
        status: "open",
        created_at: "2026-10-01T00:00:00Z",
      },
    ];
    vi.mocked(api).mockResolvedValue({ items });
    const { result } = setup(() => useAnomalies());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/security/anomalies");
    expect(result.current.data).toEqual({ items });
  });

  it("treats a missing feed (404) as no anomalies", async () => {
    vi.mocked(api).mockRejectedValue(new ApiError(404, "not_found", "backend text"));
    const { result } = setup(() => useAnomalies());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ items: [] });
  });

  it("surfaces any other failure", async () => {
    vi.mocked(api).mockRejectedValue(new ApiError(403, "forbidden", "backend text"));
    const { result } = setup(() => useAnomalies());

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useResolveAnomaly", () => {
  it("resolves the anomaly and refreshes the feed and its summary", async () => {
    const list: QueryKey = securityKeys.anomalyList("tenant-a");
    const summary: QueryKey = securityKeys.anomalySummary("tenant-a");
    const audit: QueryKey = securityKeys.auditAnomalyList("tenant-a", "all");
    const { result, client } = setup(() => useResolveAnomaly(), [list, summary, audit]);

    await act(async () => {
      await result.current.mutateAsync("an-1");
    });

    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/security/anomalies/an-1/resolve", {
      method: "POST",
    });
    expect(invalidated(client, list)).toBe(true);
    expect(invalidated(client, summary)).toBe(true);
    expect(invalidated(client, audit)).toBe(false);
  });
});

describe("useAuditAnomalies", () => {
  it("reads every audit anomaly when no status is given", async () => {
    vi.mocked(api).mockResolvedValue({ items: [] });
    const { result } = setup(() => useAuditAnomalies());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/audit/anomalies", { query: undefined });
  });

  it("filters by status when one is given", async () => {
    vi.mocked(api).mockResolvedValue({ items: [] });
    const { result } = setup(() => useAuditAnomalies("open"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/audit/anomalies", {
      query: { status: "open" },
    });
  });
});

describe("audit anomaly mutations", () => {
  const all: QueryKey = securityKeys.auditAnomalyList("tenant-a", "all");
  const open: QueryKey = securityKeys.auditAnomalyList("tenant-a", "open");
  const summary: QueryKey = securityKeys.auditAnomalySummary("tenant-a");
  const settings: QueryKey = securityKeys.auditAnomalySettings("tenant-a");

  it("resolves an audit anomaly and refreshes every audit-anomaly view", async () => {
    const { result, client } = setup(
      () => useResolveAuditAnomaly(),
      [all, open, summary, settings],
    );

    await act(async () => {
      await result.current.mutateAsync("aa-1");
    });

    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/audit/anomalies/aa-1/resolve", {
      method: "POST",
    });
    for (const key of [all, open, summary]) expect(invalidated(client, key)).toBe(true);
  });

  it("saves detection settings and refreshes only the settings", async () => {
    const body = { enabled: true, score_threshold: 0.8, min_baseline_events: 50 };
    vi.mocked(api).mockResolvedValue({ tenant_id: "tenant-a", ...body });
    const { result, client } = setup(
      () => useUpdateAuditAnomalySettings(),
      [all, summary, settings],
    );

    await act(async () => {
      await result.current.mutateAsync(body);
    });

    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/audit/anomaly-settings", {
      method: "PUT",
      body,
    });
    expect(invalidated(client, settings)).toBe(true);
    expect(invalidated(client, all)).toBe(false);
    expect(invalidated(client, summary)).toBe(false);
  });

  it("verifies the audit hash chain with a read and returns the verdict", async () => {
    const verdict = { ok: false, rows_checked: 10, broken_at_id: "ev-7", broken_reason: "hash" };
    vi.mocked(api).mockResolvedValue(verdict);
    const { result } = setup(() => useVerifyAuditChain());

    let response: unknown;
    await act(async () => {
      response = await result.current.mutateAsync();
    });

    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/audit/verify");
    expect(response).toEqual(verdict);
  });
});

describe("useBotOverview", () => {
  it("reads the recent verdicts and 24h stats", async () => {
    const overview = {
      recent: [
        {
          id: "bot-1",
          user_agent: "curl/8",
          score: 0.9,
          verdict: "blocked",
          created_at: "2026-10-01T00:00:00Z",
        },
      ],
      stats: { blocked_24h: 3, challenged_24h: 1, threshold: 0.6 },
    };
    vi.mocked(api).mockResolvedValue(overview);
    const { result } = setup(() => useBotOverview());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/security/bots");
    expect(result.current.data).toEqual(overview);
  });

  it("shows an empty overview with the default 0.7 threshold when bot detection is absent (404)", async () => {
    vi.mocked(api).mockRejectedValue(new ApiError(404, "not_found", "backend text"));
    const { result } = setup(() => useBotOverview());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      recent: [],
      stats: { blocked_24h: 0, challenged_24h: 0, threshold: 0.7 },
    });
  });

  it("surfaces any other failure", async () => {
    vi.mocked(api).mockRejectedValue(new ApiError(500, "internal", "backend text"));
    const { result } = setup(() => useBotOverview());

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useUpdateBotSettings", () => {
  it("PUTs the settings and refreshes the overview and settings", async () => {
    const overview: QueryKey = securityKeys.botOverview("tenant-a");
    const settingsKey: QueryKey = securityKeys.botSettings("tenant-a");
    const settings: BotSettings = {
      ua_check: true,
      honeypot: false,
      captcha: true,
      signature: false,
      score_threshold: 0.5,
    };
    vi.mocked(api).mockResolvedValue(settings);
    const { result, client } = setup(() => useUpdateBotSettings(), [overview, settingsKey]);

    await act(async () => {
      await result.current.mutateAsync(settings);
    });

    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/security/bots/settings", {
      method: "PUT",
      body: settings,
    });
    expect(invalidated(client, overview)).toBe(true);
    expect(invalidated(client, settingsKey)).toBe(true);
  });
});

describe("log sink mutations", () => {
  const sinks: QueryKey = securityKeys.logSinks("tenant-a");

  it("creates a sink, sending the write-only token, and refreshes the list", async () => {
    const body = { type: "splunk_hec" as const, endpoint: "https://hec.example.test", token: "t" };
    const { result, client } = setup(() => useCreateLogSink(), [sinks]);

    await act(async () => {
      await result.current.mutateAsync(body);
    });

    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/log-sinks", { method: "POST", body });
    expect(invalidated(client, sinks)).toBe(true);
  });

  it("toggles a sink and refreshes the list", async () => {
    const { result, client } = setup(() => useToggleLogSink(), [sinks]);

    await act(async () => {
      await result.current.mutateAsync({ id: "sink-1", enabled: false });
    });

    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/log-sinks/sink-1", {
      method: "PATCH",
      body: { enabled: false },
    });
    expect(invalidated(client, sinks)).toBe(true);
  });

  it("deletes a sink and refreshes the list", async () => {
    const { result, client } = setup(() => useDeleteLogSink(), [sinks]);

    await act(async () => {
      await result.current.mutateAsync("sink-1");
    });

    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/log-sinks/sink-1", {
      method: "DELETE",
    });
    expect(invalidated(client, sinks)).toBe(true);
  });
});

describe("useRevokeDeviceAuth", () => {
  it("revokes the device flow and refreshes the list", async () => {
    const devices: QueryKey = securityKeys.deviceAuthorizations("tenant-a");
    const { result, client } = setup(() => useRevokeDeviceAuth(), [devices]);

    await act(async () => {
      await result.current.mutateAsync("dev-1");
    });

    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/oauth/devices/dev-1", {
      method: "DELETE",
    });
    expect(invalidated(client, devices)).toBe(true);
  });

  it("leaves the list alone when the revocation fails", async () => {
    const devices: QueryKey = securityKeys.deviceAuthorizations("tenant-a");
    vi.mocked(api).mockRejectedValue(new ApiError(500, "internal", "backend text"));
    const { result, client } = setup(() => useRevokeDeviceAuth(), [devices]);

    await act(async () => {
      await expect(result.current.mutateAsync("dev-1")).rejects.toBeInstanceOf(ApiError);
    });

    expect(invalidated(client, devices)).toBe(false);
  });
});
