// A minimal stand-in for qeet-id-server: sign-in, refresh rotation (with the server's reuse grace),
// tenant switch, logout and the reads the console makes, for one operator in each of two tenants
// and one in both. Test controls: POST /__test__/reset, POST /__test__/expire (access tokens only),
// GET /__test__/stats.
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

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
};
const PASSWORD = "Password123!";

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
      email_verified_at: "2026-01-01T00:00:00Z",
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
  if (path === "/v1/users" && method === "GET") {
    const slug = tenants[principal.tenantId].slug; // each tenant has its own member
    return send(response, 200, {
      items: [
        {
          id: randomUUID(),
          tenant_id: principal.tenantId,
          email: `member@${slug}.example`,
          display_name: `Member of ${tenants[principal.tenantId].name}`,
          status: "active",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      next_cursor: "",
    });
  }
  if (/^\/v1\/users\/[^/]+\/tenants\/[^/]+\/permissions$/.test(path)) {
    return send(response, 200, {
      permissions: ["user.read", "tenant.read", "role.read", "audit.read", "analytics.read"],
    });
  }
  if (path === "/v1/qeetai/status") {
    return send(response, 200, { configured: false, available: false, source: "none" });
  }
  if (path === "/v1/notifications") return send(response, 200, { items: [], unread_count: 0 });
  if (method === "GET") return send(response, 200, { items: [] });
  return send(response, 200, {});
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Fake Qeet ID backend on http://127.0.0.1:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
