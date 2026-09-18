import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerSessionData } from "@/platform/auth/server-session";

const store = vi.hoisted(() => ({ data: {} as ServerSessionData, fetch: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    validator() {
      return this;
    },
    handler(callback: unknown) {
      return callback;
    },
  }),
}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("http://localhost:3002/"),
  getResponse: () => new Response(),
  clearSession: vi.fn(),
  getCookies: () => ({}),
  getRequestProtocol: () => "http",
  unsealSession: vi.fn(),
  useSession: vi.fn(),
}));
vi.mock("@/platform/auth/server-session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/platform/auth/server-session")>();
  return {
    ...actual,
    readServerSession: async () => store.data,
    clearServerSessionCookie: async () => {
      store.data = {};
    },
    openServerSession: async () => ({
      get data() {
        return store.data;
      },
      update: async (patch: ServerSessionData) => {
        store.data = { ...store.data, ...patch };
      },
      clear: async () => {
        store.data = {};
      },
    }),
  };
});
vi.mock("@/platform/telemetry/logger", () => ({ logger: { debug: vi.fn() } }));

import { proxyApiRequest, refreshServerSessionNow } from "../server-proxy";

const tokens = {
  access_token: "access-secret",
  refresh_token: "refresh-secret",
  expires_at: "2030-01-01T00:00:00Z",
  session_id: "session-a",
  user_id: "user-a",
  tenant_id: "11111111-1111-4111-8111-111111111111",
};
const first = {
  id: tokens.tenant_id,
  name: "Example",
  slug: "example",
  plan: "pro",
  region: "us-east-1",
  logo_url: "",
  domain: "",
  roles: ["owner"],
  last_used_at: null,
};
const second = { ...first, id: "22222222-2222-4222-8222-222222222222", name: "Second" };

function request(
  path: string,
  method: "GET" | "POST" = "POST",
  query: Record<string, string | number> = {},
) {
  return proxyApiRequest({
    data: { path, method, query, anonymous: false, requestId: "fixture-request" },
  });
}

beforeEach(() => {
  store.data = {};
  store.fetch.mockReset();
  vi.stubGlobal("fetch", store.fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe("Organization-selection session boundary", () => {
  it.each([
    "/v1/auth/login",
    "/v1/auth/mfa",
    "/v1/passkeys/login/finish",
    "/v1/social/exchange",
    "/saml/exchange",
    "/v1/auth/magic-link/consume",
  ])("holds the encrypted session after %s when multiple memberships exist", async (path) => {
    store.fetch
      .mockResolvedValueOnce(Response.json(tokens))
      .mockResolvedValueOnce(Response.json({ items: [first, second], next_cursor: "" }));
    const result = await request(path);
    expect(store.data.organizationSelectionRequired).toBe(true);
    expect(result.session.organizationSelectionRequired).toBe(true);
    expect(JSON.stringify(result)).not.toContain("access-secret");
    expect(JSON.stringify(result)).not.toContain("refresh-secret");
    expect(store.fetch.mock.calls[1][1].headers.Authorization).toBe("Bearer access-secret");
  });

  it.each([{ items: [] }, { items: [first] }])(
    "does not gate zero or one organization",
    async ({ items }) => {
      store.fetch
        .mockResolvedValueOnce(Response.json(tokens))
        .mockResolvedValueOnce(Response.json({ items, next_cursor: "" }));
      const result = await request("/v1/auth/login");
      expect(result.session.organizationSelectionRequired).toBe(false);
    },
  );

  it("fails closed for a failed membership lookup without failing the completed authentication", async () => {
    store.fetch
      .mockResolvedValueOnce(Response.json(tokens))
      .mockRejectedValueOnce(new Error("offline"));
    const result = await request("/v1/auth/login");
    expect(result.status).toBe(200);
    expect(result.session.isAuthenticated).toBe(true);
    expect(result.session.organizationSelectionRequired).toBe(true);
  });

  it("does not adopt a session or look up memberships before MFA completion", async () => {
    store.fetch.mockResolvedValueOnce(
      Response.json({ mfa_required: true, mfa_token: "challenge", methods: ["totp"] }),
    );
    const result = await request("/v1/auth/login");
    expect(result.session.isAuthenticated).toBe(false);
    expect(store.fetch).toHaveBeenCalledTimes(1);
  });

  it.each(["/v1/auth/signup", "/v1/signup/passkey/finish", "/v1/tenants", "/v1/invites/accept"])(
    "preserves onboarding for %s",
    async (path) => {
      store.fetch.mockResolvedValueOnce(Response.json(tokens));
      const result = await request(path);
      expect(result.session.organizationSelectionRequired).toBe(false);
      expect(store.fetch).toHaveBeenCalledTimes(1);
    },
  );

  it("preserves the selection requirement across refresh-token rotation", async () => {
    store.data = {
      accessToken: "old-access",
      refreshToken: "old-refresh",
      userId: "user-a",
      sessionId: "session-a",
      version: 1,
      organizationSelectionRequired: true,
    };
    store.fetch.mockResolvedValueOnce(Response.json(tokens));
    const result = await refreshServerSessionNow({ data: { expectedVersion: 1, force: true } });
    expect(result.organizationSelectionRequired).toBe(true);
    expect(store.data.refreshToken).toBe("refresh-secret");
  });

  it("clears the requirement only after a successful backend switch", async () => {
    store.data = {
      accessToken: "old-access",
      refreshToken: "old-refresh",
      userId: "user-a",
      sessionId: "session-a",
      organizationSelectionRequired: true,
    };
    store.fetch.mockResolvedValueOnce(
      Response.json({ error: { code: "auth.not_tenant_member" } }, { status: 403 }),
    );
    expect((await request("/v1/auth/switch-tenant")).session.organizationSelectionRequired).toBe(
      true,
    );
    store.fetch
      .mockResolvedValueOnce(Response.json({ ...tokens, tenant_id: second.id }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const result = await request("/v1/auth/switch-tenant");
    expect(result.session.organizationSelectionRequired).toBe(false);
    expect(result.session.tenantId).toBe(second.id);
    expect(store.data.accessToken).toBe("access-secret");
  });

  it("does not treat a paginated final page as a single-membership account", async () => {
    store.data = {
      accessToken: "access",
      refreshToken: "refresh",
      userId: "user-a",
      organizationSelectionRequired: true,
    };
    store.fetch.mockResolvedValueOnce(Response.json({ items: [first], next_cursor: "" }));
    expect(
      (await request("/v1/me/organizations", "GET", { cursor: second.id })).session
        .organizationSelectionRequired,
    ).toBe(true);
    store.fetch.mockResolvedValueOnce(Response.json({ items: [first], next_cursor: "" }));
    expect(
      (await request("/v1/me/organizations", "GET")).session.organizationSelectionRequired,
    ).toBe(false);
  });
});
