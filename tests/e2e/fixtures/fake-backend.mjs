import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const port = 43101;
const userId = "11111111-1111-4111-8111-111111111111";
const tenants = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    slug: "org-one",
    name: "Org One",
    plan: "enterprise",
    region: "us-east-1",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    slug: "org-two",
    name: "Org Two",
    plan: "enterprise",
    region: "us-west-2",
  },
];

let activeAccess = new Map();
let activeRefresh = new Map();
let refreshCalls = 0;

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function issuePair(tenantId = tenants[0].id) {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60_000);
  const accessToken = `${base64url({ alg: "none" })}.${base64url({
    sub: userId,
    user_id: userId,
    tenant_id: tenantId,
    sid: sessionId,
    exp: Math.floor(expiresAt.getTime() / 1000),
  })}.signature`;
  const refreshToken = `refresh_${randomUUID()}`;
  activeAccess.set(accessToken, { tenantId, sessionId });
  activeRefresh.set(refreshToken, tenantId);
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_at: expiresAt.toISOString(),
    session_id: sessionId,
    user_id: userId,
    tenant_id: tenantId,
  };
}

function bearer(request) {
  const value = request.headers.authorization ?? "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

function send(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "X-Request-Id": randomUUID(),
  });
  response.end(JSON.stringify(body));
}

function error(response, status, code, message) {
  send(response, status, { error: { code, message, retryable: false } });
}

async function jsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);

  if (url.pathname === "/healthz") return send(response, 200, { status: "ok" });
  if (url.pathname === "/__test__/reset" && request.method === "POST") {
    activeAccess = new Map();
    activeRefresh = new Map();
    refreshCalls = 0;
    return send(response, 200, { ok: true });
  }
  if (url.pathname === "/__test__/expire" && request.method === "POST") {
    activeAccess.clear();
    return send(response, 200, { ok: true });
  }
  if (url.pathname === "/__test__/stats") {
    return send(response, 200, { refresh_calls: refreshCalls });
  }

  if (url.pathname === "/v1/sso/discovery") {
    return error(response, 404, "sso.not_found", "No SSO provider is configured.");
  }
  if (url.pathname === "/v1/auth/login" && request.method === "POST") {
    const body = await jsonBody(request);
    if (body.email !== "operator@example.com" || body.password !== "Password123!") {
      return error(response, 401, "auth.invalid_credentials", "Invalid email or password.");
    }
    return send(response, 200, issuePair());
  }
  if (url.pathname === "/v1/auth/refresh" && request.method === "POST") {
    refreshCalls += 1;
    const body = await jsonBody(request);
    const tenantId = activeRefresh.get(body.refresh_token);
    if (!tenantId) {
      return error(response, 401, "auth.refresh_token_invalid", "Refresh token is invalid.");
    }
    activeRefresh.delete(body.refresh_token);
    return send(response, 200, issuePair(tenantId));
  }

  const accessToken = bearer(request);
  const principal = activeAccess.get(accessToken);
  if (!principal) return error(response, 401, "auth.session_expired", "Session expired.");

  if (url.pathname === "/v1/auth/logout" && request.method === "POST") {
    activeAccess.delete(accessToken);
    return send(response, 200, { message: "Signed out." });
  }
  if (url.pathname === "/v1/auth/switch-tenant" && request.method === "POST") {
    const body = await jsonBody(request);
    if (!tenants.some((tenant) => tenant.id === body.tenant_id)) {
      return error(response, 403, "auth.forbidden", "Tenant access denied.");
    }
    return send(response, 200, issuePair(body.tenant_id));
  }
  if (url.pathname === "/v1/me") {
    return send(response, 200, {
      id: userId,
      tenant_id: principal.tenantId,
      email: "operator@example.com",
      display_name: "Test Operator",
      status: "active",
      email_verified_at: new Date().toISOString(),
    });
  }
  if (url.pathname === "/v1/tenants") return send(response, 200, { items: tenants });
  if (/^\/v1\/users\/[^/]+\/tenants\/[^/]+\/permissions$/.test(url.pathname)) {
    return send(response, 200, {
      permissions: [
        "user.read",
        "tenant.read",
        "role.read",
        "audit.read",
        "analytics.read",
        "notification.read",
      ],
    });
  }
  if (url.pathname.endsWith("/analytics/overview")) {
    return error(response, 404, "analytics.not_found", "Analytics are unavailable.");
  }
  if (url.pathname === "/v1/qeetai/status") {
    return send(response, 200, { configured: false, available: false, source: "none" });
  }
  if (url.pathname === "/v1/me/invites") return send(response, 200, { items: [] });
  if (url.pathname === "/v1/notifications") {
    return send(response, 200, { items: [], unread_count: 0 });
  }
  if (request.method === "GET") return send(response, 200, { items: [] });
  return send(response, 200, {});
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Fake Qeet backend listening on http://127.0.0.1:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
