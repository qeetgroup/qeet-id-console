// A minimal stand-in for qeet-id-server: sign-in, refresh rotation (with the server's reuse grace),
// tenant switch, logout and the reads the console makes (records in fake-tenant-data.mjs), for one
// operator in each of two tenants, one in both, an admin and an unverified account. Test controls:
// POST /__test__/reset, POST /__test__/expire (access tokens only), GET /__test__/stats.
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

import { tenantRead } from "./fake-tenant-data.mjs";

const port = Number(process.env.FAKE_BACKEND_PORT ?? 43101);

const tenants = {
  "22222222-2222-4222-8222-222222222222": { slug: "org-one", name: "Org One" },
  "33333333-3333-4333-8333-333333333333": { slug: "org-two", name: "Org Two" },
};

const users = {
  "operator@example.com": {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Ada Operator",
    tenantIds: ["22222222-2222-4222-8222-222222222222"],
  },
  "second@example.com": {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Grace Second",
    tenantIds: ["33333333-3333-4333-8333-333333333333"],
  },
  "multi@example.com": {
    id: "55555555-5555-4555-8555-555555555555",
    name: "Max Multi",
    tenantIds: ["22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"],
  },
  "admin@example.com": {
    id: "66666666-6666-4666-8666-666666666666",
    name: "Alan Admin",
    tenantIds: ["22222222-2222-4222-8222-222222222222"],
    admin: true, // every console capability, so pages show their actions
  },
  // New accounts with no organisation yet: one with nothing waiting, one invited to Org Two.
  "fresh@example.com": {
    id: "88888888-0000-4000-8000-000000000001",
    name: "Fay Fresh",
    tenantIds: [],
  },
  "invited@example.com": {
    id: "88888888-0000-4000-8000-000000000002",
    name: "Ivan Invited",
    tenantIds: [],
    invitedTo: ["33333333-3333-4333-8333-333333333333"],
  },
  "unverified@example.com": {
    id: "77777777-7777-4777-8777-777777777777",
    name: "Uma Unverified",
    tenantIds: ["22222222-2222-4222-8222-222222222222"],
    unverified: true,
  },
};
const PASSWORD = "Password123!";
const ADMIN_PERMISSIONS = ["tenant", "user", "role", "group", "policy", "apikey", "connection"]
  .concat(["webhook", "secret", "audit", "billing"])
  .flatMap((resource) => [`${resource}.read`, `${resource}.write`])
  .concat(["branding.write", "gdpr.write", "analytics.read"]);

let accessTokens = new Map(); // token -> { email, tenantId, sessionId }
let refreshTokens = new Map(); // token -> { email, tenantId, sessionId }
let keptRotations = new Map(); // spent refresh token -> { pair, at }
let refreshCalls = 0;
let rotations = 0;
let logoutCalls = 0;

// As REFRESH_TOKEN_REUSE_GRACE on the server: a rotated refresh token sent again within the grace
// gets the pair its rotation issued, while that pair's refresh token is unused; any other reuse is
// rejected as theft.
const REUSE_GRACE_MS = 30_000;

const base64url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

function issuePair(email, tenantId, sessionId = randomUUID()) {
  const user = users[email];
  const expiresAt = new Date(Date.now() + 10 * 60_000);
  const accessToken = `${base64url({ alg: "none" })}.${base64url({
    sub: user.id,
    tenant_id: tenantId,
    sid: sessionId,
    exp: Math.floor(expiresAt.getTime() / 1000),
  })}.signature`;
  const refreshToken = `refresh_${randomUUID()}`;
  accessTokens.set(accessToken, { email, tenantId, sessionId });
  refreshTokens.set(refreshToken, { email, tenantId, sessionId });
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_at: expiresAt.toISOString(),
    session_id: sessionId,
    user_id: user.id,
    tenant_id: tenantId,
  };
}

function send(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "X-Request-Id": randomUUID(),
  });
  response.end(JSON.stringify(body));
}

const fail = (response, status, code, message) =>
  send(response, status, { error: { code, message, retryable: false } });

async function jsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function organization(tenantId) {
  const tenant = tenants[tenantId];
  return {
    id: tenantId,
    name: tenant.name,
    slug: tenant.slug,
    plan: "enterprise",
    region: "us-east-1",
    logo_url: "",
    domain: "",
    roles: ["owner"],
    last_used_at: null,
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
  };
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  const path = url.pathname;
  const method = request.method ?? "GET";

  if (path === "/healthz") return send(response, 200, { status: "ok" });
  if (path === "/__test__/reset" && method === "POST") {
    accessTokens = new Map();
    refreshTokens = new Map();
    keptRotations = new Map();
    refreshCalls = 0;
    rotations = 0;
    logoutCalls = 0;
    return send(response, 200, { ok: true });
  }
  if (path === "/__test__/expire" && method === "POST") {
    accessTokens.clear();
    return send(response, 200, { ok: true });
  }
  if (path === "/__test__/stats") {
    return send(response, 200, {
      refresh_calls: refreshCalls,
      rotations,
      logout_calls: logoutCalls,
    });
  }

  if (path === "/v1/sso/discovery") {
    return fail(response, 404, "sso.not_found", "No SSO provider is configured.");
  }
  if (path === "/v1/auth/login" && method === "POST") {
    const body = await jsonBody(request);
    const user = users[body.email];
    if (!user || body.password !== PASSWORD) {
      return fail(response, 401, "auth.invalid_credentials", "Invalid email or password.");
    }
    return send(response, 200, issuePair(body.email, user.tenantIds[0]));
  }
  if (path === "/v1/auth/refresh" && method === "POST") {
    refreshCalls += 1;
    const body = await jsonBody(request);
    const holder = refreshTokens.get(body.refresh_token);
    if (!holder) {
      const kept = keptRotations.get(body.refresh_token);
      if (
        kept &&
        Date.now() - kept.at < REUSE_GRACE_MS &&
        refreshTokens.has(kept.pair.refresh_token)
      ) {
        return send(response, 200, kept.pair);
      }
      return fail(response, 401, "auth.session_revoked", "Refresh token is invalid.");
    }
    refreshTokens.delete(body.refresh_token); // rotation: each refresh token works once
    const pair = issuePair(holder.email, holder.tenantId, holder.sessionId);
    keptRotations.set(body.refresh_token, { pair, at: Date.now() });
    rotations += 1;
    return send(response, 200, pair);
  }

  // Public, as on the server: the sign-in page and the account pages read it.
  if (path === "/v1/social/platform/providers") return send(response, 200, { providers: [] });

  const authorization = request.headers.authorization ?? "";
  const principal = accessTokens.get(authorization.replace(/^Bearer\s+/i, ""));
  if (!principal) return fail(response, 401, "auth.session_expired", "Session expired.");
  const user = users[principal.email];

  if (path === "/v1/auth/logout" && method === "POST") {
    logoutCalls += 1;
    for (const [token, holder] of accessTokens) {
      if (holder.sessionId === principal.sessionId) accessTokens.delete(token);
    }
    for (const [token, holder] of refreshTokens) {
      if (holder.sessionId === principal.sessionId) refreshTokens.delete(token);
    }
    return send(response, 200, { message: "Signed out." });
  }
  if (path === "/v1/me") {
    return send(response, 200, {
      id: user.id,
      tenant_id: principal.tenantId,
      email: principal.email,
      display_name: user.name,
      status: "active",
      email_verified_at: user.unverified ? null : "2026-01-01T00:00:00Z",
    });
  }
  if (path === "/v1/auth/switch-tenant" && method === "POST") {
    const body = await jsonBody(request);
    if (!user.tenantIds.includes(body.tenant_id)) {
      return fail(response, 403, "auth.not_tenant_member", "Not a member of that tenant.");
    }
    return send(response, 200, issuePair(principal.email, body.tenant_id));
  }
  if (path === "/v1/me/organizations") {
    return send(response, 200, { items: user.tenantIds.map(organization), next_cursor: "" });
  }
  if (path === "/v1/tenants") {
    return send(response, 200, { items: user.tenantIds.map(organization) });
  }
  if (path === `/v1/tenants/${principal.tenantId}`) {
    return send(response, 200, organization(principal.tenantId));
  }
  if (/^\/v1\/users\/[^/]+\/tenants\/[^/]+\/permissions$/.test(path)) {
    return send(response, 200, {
      permissions: user.admin
        ? ADMIN_PERMISSIONS
        : ["user.read", "tenant.read", "role.read", "audit.read", "analytics.read"],
    });
  }
  if (path === "/v1/qeetai/status") {
    return send(response, 200, { configured: false, available: false, source: "none" });
  }
  if (path === "/v1/notifications") return send(response, 200, { items: [], unread_count: 0 });
  // The server's built-in catalogue (qeet-id-server billing/plans.go), in two currencies.
  if (path === "/v1/me/invites") {
    return send(response, 200, {
      items: (user.invitedTo ?? []).map((tenantId) => ({
        id: `invite-${tenantId.slice(0, 8)}`,
        tenant_id: tenantId,
        tenant_name: tenants[tenantId].name,
        tenant_slug: tenants[tenantId].slug,
        email: principal.email,
        role_id: null,
        expires_at: new Date(Date.now() + 6 * 86_400_000).toISOString(),
        created_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
      })),
    });
  }
  if (path === "/v1/billing/plans") {
    const plan = (code, name, description, features, INR, USD) => ({
      id: code,
      code,
      name,
      description,
      interval: code.endsWith("_year") ? "year" : "month",
      features,
      prices: { INR, USD },
    });
    const features = {
      free: [
        "Up to 10,000 monthly active users",
        "Passkeys, social & password login",
        "7-day audit log",
      ],
      starter: ["Up to 25,000 MAU", "Custom branding & domain", "Webhooks & 30-day audit log"],
      pro: [
        "Up to 100,000 MAU (then metered)",
        "Enterprise SSO — SAML & OIDC included",
        "Audit export (90-day) & Qeet AI",
      ],
      enterprise: [
        "Unlimited MAU & organizations",
        "SCIM & LDAP directory sync",
        "99.99% SLA · named CSM",
      ],
    };
    return send(response, 200, {
      items: [
        plan("free", "Free", "For prototypes and early projects.", features.free, 0, 0),
        plan(
          "starter",
          "Starter",
          "For teams shipping to production.",
          features.starter,
          240000,
          2900,
        ),
        plan("pro", "Pro", "For scaling B2B/B2C — no SSO tax.", features.pro, 800000, 9900),
        plan(
          "enterprise",
          "Enterprise",
          "Governance, compliance & control for large orgs.",
          features.enterprise,
          2490000,
          29900,
        ),
        plan(
          "starter_year",
          "Starter",
          "For teams shipping to production. Billed yearly.",
          features.starter,
          2400000,
          29000,
        ),
        plan(
          "pro_year",
          "Pro",
          "For scaling B2B/B2C — no SSO tax. Billed yearly.",
          features.pro,
          8000000,
          99000,
        ),
      ],
    });
  }
  // The signed-in person's own sign-in settings, which the account pages read.
  const ago = (ms) => new Date(Date.now() - ms).toISOString();
  if (path === "/v1/mfa/totp") return send(response, 200, { enrolled: true });
  if (path === "/v1/mfa/recovery-codes") {
    return send(response, 200, { enrolled: true, total: 10, remaining: 8 });
  }
  if (path === "/v1/auth/password") return send(response, 200, { has_password: true });
  if (path === "/v1/auth/sign-in-methods") {
    return send(response, 200, { password: true, passkeys: 1, linked_identities: 0, total: 2 });
  }
  if (path === "/v1/passkeys" && method === "GET") {
    return send(response, 200, {
      items: [
        {
          id: "passkey-1",
          user_id: user.id,
          name: "MacBook Pro (Touch ID)",
          transports: ["internal"],
          created_at: ago(60 * 86_400_000),
          last_used_at: ago(5 * 60_000),
        },
      ],
      enrollment_allowed: true,
    });
  }
  if (path === "/v1/auth/sessions" && method === "GET") {
    const session = (id, device, device_kind, country, ip, since, seen) => ({
      id,
      user_id: user.id,
      tenant_id: principal.tenantId ?? "",
      ip,
      device,
      device_kind,
      country,
      created_at: ago(since),
      last_seen_at: ago(seen),
      status: "active",
      current: id === principal.sessionId,
    });
    return send(response, 200, {
      items: [
        session(
          principal.sessionId,
          "Chrome on macOS",
          "desktop",
          "IN",
          "103.21.58.14",
          3 * 3_600_000,
          0,
        ),
        session(
          "session-phone",
          "Safari on iPhone",
          "mobile",
          "IN",
          "49.36.112.7",
          2 * 86_400_000,
          2 * 3_600_000,
        ),
      ],
    });
  }
  if (method === "GET") {
    const tenant = tenants[principal.tenantId];
    // A new account has no organisation: nothing tenant-scoped to read.
    if (!tenant) return send(response, 200, { items: [] });
    const context = { tenantId: principal.tenantId, tenant, principalId: user.id };
    return send(response, 200, tenantRead(path, url.searchParams, context) ?? { items: [] });
  }
  return send(response, 200, {});
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Fake Qeet ID backend on http://127.0.0.1:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
