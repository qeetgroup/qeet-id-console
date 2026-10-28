// An organization's records for the fake backend: enough for each page the accessibility spec opens
// to render its real content (tables, charts, detail panels) rather than an empty or error state.
// Ids are fixed so a test can open a record's own page.

const CREATED = "2026-01-01T00:00:00Z";
const DAY_MS = 86_400_000;

export const MEMBER_ID = "88888888-8888-4888-8888-888888888888";
const INVITED_ID = "88888888-8888-4888-8888-888888888889";
const SUSPENDED_ID = "88888888-8888-4888-8888-88888888888a";

const ago = (ms) => new Date(Date.now() - ms).toISOString();
const days = (n, value) =>
  Array.from({ length: n }, (_, i) => ({
    date: new Date(Date.now() - (n - 1 - i) * DAY_MS).toISOString().slice(0, 10),
    value: value(i),
  }));

/** The members of a tenant; the first is unique to it, so two tenants never list the same person. */
export function members(tenantId, tenant) {
  const first = {
    id: tenant.slug === "org-one" ? MEMBER_ID : `${MEMBER_ID.slice(0, -4)}0002`,
    tenant_id: tenantId,
    email: `member@${tenant.slug}.example`,
    display_name: `Member of ${tenant.name}`,
    status: "active",
    email_verified_at: CREATED,
    roles: ["Admin"],
    created_at: CREATED,
    updated_at: CREATED,
    mfa_enabled: true,
    groups_count: 1,
    last_seen_at: ago(3_600_000),
    last_seen_ip: "203.0.113.10",
  };
  if (tenant.slug !== "org-one") return [first];
  // Profiles say where each person sits and works, for the Dashboard's Organisation row.
  const at = (department, team, location) => ({ metadata: { department, team, location } });
  return [
    { ...first, ...at("Engineering", "Platform", "Bengaluru, IN") },
    {
      id: INVITED_ID,
      tenant_id: tenantId,
      email: "priya@org-one.example",
      display_name: "Priya Patel",
      ...at("Engineering", "Payments", "Bengaluru, IN"),
      status: "invited",
      roles: [],
      created_at: CREATED,
      mfa_enabled: false,
      groups_count: 0,
    },
    {
      id: SUSPENDED_ID,
      tenant_id: tenantId,
      email: "sam@org-one.example",
      display_name: "Sam Lee",
      ...at("Support", undefined, "Berlin, DE"),
      status: "suspended",
      email_verified_at: CREATED,
      roles: ["Support"],
      created_at: CREATED,
      mfa_enabled: false,
      groups_count: 1,
      last_seen_at: ago(9 * DAY_MS),
    },
  ];
}

const roles = (tenantId) =>
  [
    ["Owner", "Full control of the organization.", true],
    ["Admin", "Manages members, applications and settings.", true],
    ["Support", "Reads members and resets their sign-in.", false],
  ].map(([name, description, isSystem], i) => ({
    id: `99999999-9999-4999-8999-99999999999${i}`,
    tenant_id: tenantId,
    name,
    description,
    is_system: isSystem,
    created_at: CREATED,
  }));

const groups = (tenantId) => [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    tenant_id: tenantId,
    parent_id: null,
    name: "Engineering",
    description: "Everyone who builds the product.",
    created_at: CREATED,
    member_count: 2,
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    tenant_id: tenantId,
    parent_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    name: "Platform",
    description: "Runs the shared infrastructure.",
    created_at: CREATED,
    member_count: 1,
  },
];

const metric = (value, deltaPct) => ({ value, delta_pct: deltaPct });

function analyticsOverview() {
  const methods = ["password", "passkey", "social", "saml", "oidc", "magic_link", "ldap"];
  return {
    generated_at: new Date().toISOString(),
    kpis: {
      mau: metric(1240, 4.2),
      logins_today: metric(312, -1.5),
      mfa_adoption_pct: metric(72.5, 2.1),
      failed_logins_24h: metric(18, -12),
      dau: metric(420, 3),
      total_users: metric(1500, 1.2),
      avg_sessions_per_user: metric(2.4, 0),
      stickiness_pct: metric(34, 1),
    },
    weekly_activity_8w: Array.from({ length: 8 }, (_, i) => ({
      week: new Date(Date.now() - (7 - i) * 7 * DAY_MS).toISOString().slice(0, 10),
      wau: 800 + i * 20,
      dau: 380 + i * 5,
    })),
    user_trend_14d: days(14, (i) => 1400 + i * 7),
    login_trend_14d: days(14, (i) => 280 + (i % 5) * 9),
    mfa_trend_14d: days(14, (i) => 70 + i * 0.2),
    failed_trend_14d: days(14, (i) => 12 + (i % 4)),
    login_activity_14d: days(14, (i) => i).map(({ date }, i) => ({
      date,
      password: 120 + i,
      passkey: 80 + i * 2,
      social: 40,
      saml: 30,
      oidc: 20,
      magic_link: 8,
      ldap: 4,
    })),
    login_methods_mix: methods.map((method, i) => ({ method, value: 40 - i * 5 })),
    mfa_methods_adoption: ["TOTP", "Passkey", "SMS", "Email", "Recovery Codes"].map(
      (method, i) => ({
        method,
        users: 500 - i * 80,
      }),
    ),
    failed_logins_hourly_24h: Array.from({ length: 24 }, (_, hour) => ({
      hour: `${String(hour).padStart(2, "0")}:00`,
      attempts: (hour * 7) % 5,
    })),
  };
}

function activity(query, principalId) {
  const event = (id, type, category, severity, title, at) => ({
    id: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb${id}`,
    type,
    category,
    severity,
    title,
    actor: { id: principalId, name: "Alan Admin", type: "user" },
    target: { type: "user", id: MEMBER_ID, label: "member@org-one.example" },
    at,
    source: "console",
    ip: "203.0.113.10",
    status: "success",
  });
  if (query.get("category") === "developer") {
    return [
      event(1, "apikey.created", "developer", "info", "API key created", ago(2 * 3_600_000)),
      event(2, "webhook.subscription_created", "developer", "info", "Webhook created", ago(DAY_MS)),
    ];
  }
  return [
    event(3, "auth.login_succeeded", "authentication", "success", "Signed in", ago(600_000)),
    event(4, "user.updated", "user", "info", "Profile updated", ago(3_600_000)),
    event(5, "auth.login_failed", "authentication", "warning", "Sign-in failed", ago(DAY_MS)),
  ];
}

function userViews(user, tenantId, tenant, view) {
  if (view === "") return user;
  if (view === "/security") {
    return {
      mfa_required: false,
      mfa_enabled: user.mfa_enabled === true,
      totp_enabled: user.mfa_enabled === true,
      otp_factors: 0,
      push_devices: 0,
      passkeys: 1,
      passkey_last_used_at: ago(DAY_MS),
      recovery_codes_remaining: 8,
      password_set: true,
      password_changed_at: CREATED,
      active_sessions: 1,
      distinct_devices: 1,
    };
  }
  if (view === "/sessions") {
    return {
      items: [
        {
          id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
          ip: "203.0.113.10",
          user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/130.0 Safari/537.36",
          created_at: ago(DAY_MS),
          last_seen_at: ago(3_600_000),
        },
      ],
    };
  }
  if (view === "/access") {
    const [, admin] = roles(tenantId);
    const [engineering] = groups(tenantId);
    return {
      organization: { id: tenantId, name: tenant.name, slug: tenant.slug },
      roles: admin ? [admin] : [],
      groups: engineering ? [engineering] : [],
      applications_count: 2,
      policies_count: 1,
      permissions_direct: 12,
      permissions_inherited: 3,
      permissions_total: 15,
    };
  }
  return undefined;
}

/**
 * Returns the body for an organization read the pages make, or undefined to fall through to the
 * fake backend's generic answers. `principal` is the signed-in person.
 */
export function tenantRead(path, query, { tenantId, tenant, principalId }) {
  const tenantPath = `/v1/tenants/${tenantId}`;
  const people = members(tenantId, tenant);

  if (path === "/v1/users") return { items: people, next_cursor: "" };
  if (path === "/v1/users/stats") {
    return {
      total: people.length,
      active: people.filter((u) => u.status === "active").length,
      suspended: people.filter((u) => u.status === "suspended").length,
      invited: people.filter((u) => u.status === "invited").length,
      mfa_enabled: people.filter((u) => u.mfa_enabled).length,
      mfa_missing: people.filter((u) => !u.mfa_enabled).length,
      new_last_30d: 2,
    };
  }
  if (path === "/v1/users/trends") {
    return {
      total: Array.from({ length: 30 }, (_, i) => Math.min(people.length, 1 + Math.floor(i / 10))),
      mfa_enabled: Array.from({ length: 30 }, () => 1),
    };
  }
  const userPath = path.match(/^\/v1\/users\/([^/]+)(\/security|\/sessions|\/access)?$/);
  const user = userPath && people.find((u) => u.id === userPath[1]);
  if (user) return userViews(user, tenantId, tenant, userPath[2] ?? "");

  if (path === "/v1/users/suspended") {
    const items = people
      .filter((u) => u.status === "suspended")
      .map((u) => ({
        id: u.id,
        email: u.email,
        display_name: u.display_name,
        avatar_url: null,
        team: "",
        reason: "offboarding",
        source: "manual",
        risk: "low",
        review: "pending",
        suspended_at: ago(5 * DAY_MS),
        last_sign_in: u.last_seen_at ?? null,
        can_manage: true,
      }));
    return {
      items,
      total: items.length,
      limit: 50,
      offset: 0,
      summary: {
        total: items.length,
        high_risk: 0,
        policy: 0,
        manual: items.length,
        pending: items.length,
      },
      reasons: items.length ? [{ key: "offboarding", count: items.length }] : [],
      risks: items.length ? [{ key: "low", count: items.length }] : [],
      queue: items,
      teams: [],
    };
  }
  if (path === "/v1/users/deleted") {
    return {
      items: [
        {
          id: "ffffffff-ffff-4fff-8fff-fffffffffff1",
          email: `anil@${tenant.slug}.example`,
          display_name: "Anil Bhatia",
          deleted_at: ago(17 * DAY_MS),
          deleted_by: principalId,
          created_at: CREATED,
        },
      ],
    };
  }
  if (path === `${tenantPath}/invites`) {
    const invite = (n, status, sentDaysAgo, acceptedDaysAgo) => ({
      id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa${String(n).padStart(2, "0")}`,
      tenant_id: tenantId,
      email: `${["kavya", "ravi", "omar", "imran"][n - 1]}@${tenant.slug}.example`,
      role_id: null,
      status,
      expires_at: ago((sentDaysAgo - 14) * DAY_MS),
      accepted_at: acceptedDaysAgo === undefined ? null : ago(acceptedDaysAgo * DAY_MS),
      created_at: ago(sentDaysAgo * DAY_MS),
    });
    return {
      items: [
        invite(1, "pending", 2),
        invite(2, "accepted", 30, 28),
        invite(3, "expired", 40),
        invite(4, "revoked", 10),
      ],
    };
  }
  // The organisation's own history (audit events on the tenant), and its verified domain.
  if (path === `${tenantPath}/audit` && query.get("resource_type") === "tenant") {
    const change = (id, action, actor, daysAgo) => ({
      id: `cccccccc-cccc-4ccc-8ccc-cccccccccc0${id}`,
      tenant_id: tenantId,
      actor_user_id: actor,
      actor_type: "user",
      action,
      resource_type: "tenant",
      resource_id: tenantId,
      ip: "203.0.113.34",
      user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/153.0.0.0 Safari/537.36",
      created_at: ago(daysAgo * DAY_MS),
    });
    return {
      items: [
        change(3, "security_policy.updated", people[0]?.id, 12),
        change(2, "branding.updated", principalId, 200),
        change(1, "tenant.created", principalId, 300),
      ],
      next_cursor: "",
    };
  }
  if (path === `${tenantPath}/domains`) {
    return {
      items: [
        {
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddd01",
          domain: `${tenant.slug}.example`,
          verified_at: CREATED,
          created_at: CREATED,
        },
      ],
    };
  }
  if (path === `${tenantPath}/retention`)
    return { deleted_users_enabled: true, deleted_users_days: 90 };
  if (path === "/v1/activity") return { events: activity(query, principalId), next_cursor: "" };
  if (path === `${tenantPath}/analytics/overview`) return analyticsOverview();
  if (path === `${tenantPath}/roles`) return { items: roles(tenantId) };
  if (path === `${tenantPath}/groups`) return { items: groups(tenantId) };
  if (path === `${tenantPath}/directory/errors`) {
    return {
      items: [],
      total: 0,
      limit: Number(query.get("limit") ?? 25),
      offset: 0,
      summary: { open: 0, critical: 0, warning: 0, retried: 0, impacted_users: 0 },
      categories: [],
      connections: [],
      remediations: [],
    };
  }
  if (path === `${tenantPath}/api-keys`) {
    return {
      items: [
        {
          id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
          tenant_id: tenantId,
          name: "CI deploys",
          prefix: "qk_live_ab12",
          scopes: ["user.read"],
          created_at: ago(2 * 3_600_000),
          expires_at: null,
          revoked_at: null,
        },
      ],
    };
  }
  if (path === `${tenantPath}/webhooks`) {
    return {
      items: [
        {
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
          tenant_id: tenantId,
          url: "https://hooks.example.com/qeet",
          events: ["user.created"],
          disabled_at: null,
          created_at: ago(DAY_MS),
        },
      ],
    };
  }
  return undefined;
}
