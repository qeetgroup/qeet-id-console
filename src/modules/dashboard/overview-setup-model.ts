// The organisation's set-up as a checklist, from API data: each item's state in the console's
// shared words, one line of detail as a catalogue key with its values, and an action only for an
// item that needs something. A source the person can't read, or one still loading, is `undefined`
// and its item drops out.

import type { TranslationKey } from "@/i18n";
import type {
  LdapConnection,
  OidcClient,
  SamlConnection,
  SamlProvider,
  ScimConfig,
} from "@/modules/authentication";
import type { Subscription } from "@/modules/billing";
import type { ApiKey, Webhook } from "@/modules/developer";
import type { Group } from "@/modules/groups";
import type { TenantDomain } from "@/modules/organizations";
import type { UserStats } from "@/modules/users";
import { type Failure, groupsItem, ldapItem } from "./overview-directory-model";
import { DAY_MS, KEY_EXPIRY_SOON_DAYS } from "./overview-model";

type Params = Record<string, string | number>;
/** A phrase to translate: a catalogue key and its values. */
export type Phrase = { key: TranslationKey; params?: Params };

// ── Set-up ──────────────────────────────────────────────────────────────────────────────────

export type SetupState = "done" | "attention" | "failing" | "setup" | "none";
/** The order the summary bar reads in: done, then what needs you, then the rest. */
export const SETUP_ORDER: SetupState[] = ["done", "failing", "attention", "setup", "none"];

export interface SetupItem {
  id: string;
  name: TranslationKey;
  state: SetupState;
  detail: Phrase;
  /** Only an item that needs something has one. */
  action?: { label: TranslationKey; to: string };
}

export interface SetupGroup {
  id: "signIn" | "people" | "developers";
  items: SetupItem[];
}

export interface SetupSources {
  saml?: SamlConnection[];
  samlApps?: SamlProvider[];
  methods?: string[]; // the sign-in methods turned on, already named
  userStats?: UserStats;
  pendingInvites?: number;
  /** How many departments people are in, from their profiles. */
  departments?: number;
  domains?: TenantDomain[];
  scim?: ScimConfig;
  ldap?: LdapConnection[];
  /** Directory connections whose connection check is failing, by id. */
  failing?: ReadonlyMap<string, Failure>;
  groups?: Group[];
  clients?: OidcClient[];
  unusedClients?: number;
  apiKeys?: ApiKey[];
  webhooks?: Webhook[];
  subscription?: Subscription;
  formatAmount?: (minor: number, currency: string) => string;
  formatDate?: (iso: string) => string;
  now?: Date;
}

const names = (items: { name: string }[], max = 2) =>
  items.length > max
    ? `${items
        .slice(0, max)
        .map((i) => i.name)
        .join(", ")} +${items.length - max}`
    : items.map((i) => i.name).join(", ");

function samlItem(saml: SamlConnection[]): SetupItem {
  const active = saml.filter((c) => c.status === "active");
  const draft = saml.filter((c) => c.status === "draft");
  const base = { id: "sso", name: "dashboard:overview.setup.items.sso" as const };
  if (active.length)
    return {
      ...base,
      state: "done",
      detail: {
        key: "dashboard:overview.setup.details.connected",
        params: { names: names(active) },
      },
    };
  if (draft.length)
    return {
      ...base,
      state: "setup",
      detail: { key: "dashboard:overview.setup.details.draft", params: { names: names(draft) } },
      action: { label: "dashboard:overview.setup.actions.finish", to: "/auth/connections/saml" },
    };
  return {
    ...base,
    state: "none",
    detail: { key: "dashboard:overview.setup.details.ssoNone" },
    action: { label: "dashboard:overview.setup.actions.setUp", to: "/auth/connections/saml" },
  };
}

function samlAppsItem(apps: SamlProvider[]): SetupItem {
  const live = apps.filter((a) => a.status === "active");
  const draft = apps.filter((a) => a.status === "draft");
  const base = { id: "samlApps", name: "dashboard:overview.setup.items.samlApps" as const };
  if (draft.length)
    return {
      ...base,
      state: "setup",
      detail: live.length
        ? {
            key: "dashboard:overview.setup.details.liveAndDraft",
            params: { live: names(live), draft: names(draft, 1) },
          }
        : { key: "dashboard:overview.setup.details.draft", params: { names: names(draft) } },
      action: {
        label: "dashboard:overview.setup.actions.finish",
        to: "/auth/connections/saml-idp",
      },
    };
  if (live.length)
    return {
      ...base,
      state: "done",
      detail: { key: "dashboard:overview.setup.details.live", params: { names: names(live) } },
    };
  return {
    ...base,
    state: "none",
    detail: { key: "dashboard:overview.setup.details.samlAppsNone" },
    action: { label: "dashboard:overview.setup.actions.add", to: "/auth/connections/saml-idp" },
  };
}

function domainItem(domains: TenantDomain[]): SetupItem {
  const base = { id: "domain", name: "dashboard:overview.setup.items.domain" as const };
  const to = "/settings/organization/domains";
  const verified = domains.filter((d) => d.status === "verified");
  const attention = domains.find((d) => d.status === "attention");
  const pending = domains.find((d) => d.status === "pending");
  if (attention)
    return {
      ...base,
      state: "attention",
      detail: {
        key: "dashboard:overview.setup.details.domainCheckFailed",
        params: { domain: attention.domain },
      },
      action: { label: "dashboard:overview.setup.actions.check", to },
    };
  if (verified.length)
    return {
      ...base,
      state: "done",
      detail: {
        key: "dashboard:overview.setup.details.verified",
        params: {
          names: verified
            .map((d) => d.domain)
            .slice(0, 2)
            .join(", "),
        },
      },
    };
  if (pending)
    return {
      ...base,
      state: "setup",
      detail: {
        key: "dashboard:overview.setup.details.domainPending",
        params: { domain: pending.domain },
      },
      action: { label: "dashboard:overview.setup.actions.verify", to },
    };
  return {
    ...base,
    state: "none",
    detail: { key: "dashboard:overview.setup.details.domainNone" },
    action: { label: "dashboard:overview.setup.actions.add", to },
  };
}

/** "45 people · 7 departments · 3 invitations pending": departments only once there are two. */
function teamDetail(people: number, departments: number, pending: number): Phrase {
  const d = departments > 1;
  if (pending)
    return {
      key: d
        ? "dashboard:overview.setup.details.teamDepartmentsPending"
        : "dashboard:overview.setup.details.teamPending",
      params: { count: pending, people, departments },
    };
  return {
    key: d
      ? "dashboard:overview.setup.details.teamDepartments"
      : "dashboard:overview.setup.details.team",
    params: { count: people, departments },
  };
}

function keysItem(keys: ApiKey[], now: Date): SetupItem {
  const base = { id: "apiKeys", name: "dashboard:overview.setup.items.apiKeys" as const };
  const to = "/auth/api/keys";
  const active = keys.filter(
    (k) => !k.revoked_at && (!k.expires_at || new Date(k.expires_at).getTime() > now.getTime()),
  );
  if (!active.length)
    return {
      ...base,
      state: "none",
      detail: { key: "dashboard:overview.setup.details.keysNone" },
      action: { label: "dashboard:overview.setup.actions.create", to },
    };
  const soon = active
    .map((k) =>
      k.expires_at
        ? (new Date(k.expires_at).getTime() - now.getTime()) / DAY_MS
        : Number.POSITIVE_INFINITY,
    )
    .filter((d) => d <= KEY_EXPIRY_SOON_DAYS)
    .sort((a, b) => a - b);
  const soonest = soon[0];
  if (soonest !== undefined)
    return {
      ...base,
      state: "attention",
      detail: {
        key: "dashboard:overview.setup.details.keysExpiring",
        params: { count: active.length, days: Math.max(1, Math.ceil(soonest)) },
      },
      action: { label: "dashboard:overview.setup.actions.rotate", to },
    };
  return {
    ...base,
    state: "done",
    detail: {
      key: "dashboard:overview.setup.details.keysActive",
      params: { count: active.length },
    },
  };
}

function webhooksItem(hooks: Webhook[]): SetupItem {
  const base = { id: "webhooks", name: "dashboard:overview.setup.items.webhooks" as const };
  const to = "/developer/webhooks";
  const off = hooks.filter((h) => h.disabled_at && h.disabled_reason === "failing").length;
  const failing = hooks.filter((h) => !h.disabled_at && h.failing_since).length;
  const live = hooks.filter((h) => !h.disabled_at).length;
  if (off || failing)
    return {
      ...base,
      state: "failing",
      detail: { key: "dashboard:overview.setup.details.webhooksFailing", params: { failing, off } },
      action: { label: "dashboard:overview.setup.actions.fix", to },
    };
  if (live)
    return {
      ...base,
      state: "done",
      detail: { key: "dashboard:overview.setup.details.webhooksActive", params: { count: live } },
    };
  return {
    ...base,
    state: "none",
    detail: { key: "dashboard:overview.setup.details.webhooksNone" },
    action: { label: "dashboard:overview.setup.actions.add", to },
  };
}

function planItem(
  sub: Subscription,
  formatAmount: (minor: number, currency: string) => string,
  formatDate: (iso: string) => string,
): SetupItem {
  const base = { id: "plan", name: "dashboard:overview.setup.items.plan" as const };
  const to = "/settings/billing";
  const plan = sub.plan_name || sub.plan_code;
  const status = (sub.status ?? "").toLowerCase();
  if (status === "past_due" || status === "unpaid")
    return {
      ...base,
      state: "failing",
      detail: { key: "dashboard:overview.setup.details.planPaymentDue", params: { plan } },
      action: { label: "dashboard:overview.setup.actions.billing", to },
    };
  if (status === "trialing" && sub.trial_end)
    return {
      ...base,
      state: "setup",
      detail: {
        key: "dashboard:overview.setup.details.planTrial",
        params: { plan, date: formatDate(sub.trial_end) },
      },
      action: { label: "dashboard:overview.setup.actions.choosePlan", to },
    };
  if (!sub.amount_minor)
    return {
      ...base,
      state: "done",
      detail: { key: "dashboard:overview.setup.details.planFree", params: { plan } },
    };
  const amount = formatAmount(sub.amount_minor, sub.currency);
  return sub.current_period_end
    ? {
        ...base,
        state: "done",
        detail: {
          key:
            sub.interval === "year"
              ? "dashboard:overview.setup.details.planYearly"
              : "dashboard:overview.setup.details.planMonthly",
          params: { plan, amount, date: formatDate(sub.current_period_end) },
        },
      }
    : {
        ...base,
        state: "done",
        detail: { key: "dashboard:overview.setup.details.planFree", params: { plan } },
      };
}

/** The organisation's set-up in three groups. An item whose data isn't there (no access, still loading) is left out. */
export function deriveSetup(s: SetupSources): SetupGroup[] {
  const now = s.now ?? new Date();
  const formatDate = s.formatDate ?? ((iso: string) => iso.slice(0, 10));
  const formatAmount =
    s.formatAmount ??
    ((minor: number, currency: string) => `${currency} ${(minor / 100).toFixed(2)}`);
  const signIn: SetupItem[] = [];
  const people: SetupItem[] = [];
  const developers: SetupItem[] = [];

  if (s.saml) signIn.push(samlItem(s.saml));
  if (s.methods)
    signIn.push(
      s.methods.length
        ? {
            id: "methods",
            name: "dashboard:overview.setup.items.methods",
            state: "done",
            detail: {
              key: "dashboard:overview.setup.details.list",
              params: { list: s.methods.join(", ") },
            },
          }
        : {
            id: "methods",
            name: "dashboard:overview.setup.items.methods",
            state: "attention",
            detail: { key: "dashboard:overview.setup.details.methodsNone" },
            action: {
              label: "dashboard:overview.setup.actions.review",
              to: "/auth/login-methods/password",
            },
          },
    );
  if (s.userStats) {
    const { mfa_missing: missing, total } = s.userStats;
    signIn.push(
      missing > 0
        ? {
            id: "twoStep",
            name: "dashboard:overview.setup.items.twoStep",
            state: "attention",
            detail: {
              key: "dashboard:overview.setup.details.twoStepMissing",
              params: { count: missing, total },
            },
            action: {
              label: "dashboard:overview.setup.actions.requireIt",
              to: "/settings/organization/security-policy",
            },
          }
        : {
            id: "twoStep",
            name: "dashboard:overview.setup.items.twoStep",
            state: "done",
            detail: { key: "dashboard:overview.setup.details.twoStepEveryone" },
          },
    );
  }
  if (s.samlApps) signIn.push(samlAppsItem(s.samlApps));

  if (s.userStats) {
    const pending = s.pendingInvites ?? 0;
    people.push(
      s.userStats.total > 1 || pending > 0
        ? {
            id: "team",
            name: "dashboard:overview.setup.items.team",
            state: "done",
            detail: teamDetail(s.userStats.total, s.departments ?? 0, pending),
          }
        : {
            id: "team",
            name: "dashboard:overview.setup.items.team",
            state: "none",
            detail: { key: "dashboard:overview.setup.details.teamOnlyYou" },
            action: { label: "dashboard:overview.setup.actions.invite", to: "/invitations" },
          },
    );
  }
  if (s.groups) people.push(groupsItem(s.groups));
  if (s.domains) people.push(domainItem(s.domains));
  if (s.scim)
    people.push(
      s.scim.token_set
        ? {
            id: "scim",
            name: "dashboard:overview.setup.items.scim",
            state: "done",
            detail: {
              key: "dashboard:overview.setup.details.scimProvisioned",
              params: { count: s.scim.provisioned_count },
            },
          }
        : {
            id: "scim",
            name: "dashboard:overview.setup.items.scim",
            state: "none",
            detail: { key: "dashboard:overview.setup.details.scimNone" },
            action: {
              label: "dashboard:overview.setup.actions.setUp",
              to: "/auth/connections/scim",
            },
          },
    );
  if (s.ldap) people.push(ldapItem(s.ldap, formatDate, s.failing, now));

  if (s.clients)
    developers.push(
      s.clients.length
        ? {
            id: "apps",
            name: "dashboard:overview.setup.items.apps",
            state: "done",
            detail: {
              key: s.unusedClients
                ? "dashboard:overview.setup.details.appsUnused"
                : "dashboard:overview.setup.details.apps",
              params: { count: s.clients.length, unused: s.unusedClients ?? 0 },
            },
          }
        : {
            id: "apps",
            name: "dashboard:overview.setup.items.apps",
            state: "none",
            detail: { key: "dashboard:overview.setup.details.appsNone" },
            action: {
              label: "dashboard:overview.setup.actions.register",
              to: "/auth/connections/oidc",
            },
          },
    );
  if (s.apiKeys) developers.push(keysItem(s.apiKeys, now));
  if (s.webhooks) developers.push(webhooksItem(s.webhooks));
  if (s.subscription && (s.subscription.plan_name || s.subscription.plan_code))
    developers.push(planItem(s.subscription, formatAmount, formatDate));

  const groups: SetupGroup[] = [
    { id: "signIn", items: signIn },
    { id: "people", items: people },
    { id: "developers", items: developers },
  ];
  return groups.filter((g) => g.items.length);
}
