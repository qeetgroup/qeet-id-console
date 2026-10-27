// What the Dashboard adds now that it's the console's one overview (the area overviews are gone):
// the directory's and authorization's own alerts for Needs attention, the LDAP and Groups set-up
// items, and the organisation's shape — departments and their teams, and where people work. Pure,
// so the page and its tests share it. Each source the person can't read is `undefined` and adds
// nothing.
import type { LdapConnection } from "@/modules/authentication";
import type { PostureFinding } from "@/modules/authorization";
import type { DirectoryConnection, DirectoryErrorPage, ErrorFilters } from "@/modules/directory";
import type { Group } from "@/modules/groups";
import type { User } from "@/modules/users";
import { DAY_MS, type OverviewAttention } from "./overview-model";
import type { SetupItem } from "./overview-setup-model";

// ── Directory connections that can't connect ───────────────────────────────────────────────

/** What the Dashboard asks the directory for: open critical failures, as far back as it keeps. */
export const FAILING_FILTERS: ErrorFilters = {
  days: 90,
  connection_id: "",
  severity: "critical",
  resolution: "open",
  q: "",
  limit: 100,
  offset: 0,
};

export type Failure = { at: string; message: string; code: string };

/**
 * The directory connections whose connection check has an open critical failure: the newest one
 * for each connection.
 */
export function failingConnections(errors?: DirectoryErrorPage): Map<string, Failure> {
  const out = new Map<string, Failure>();
  for (const e of errors?.items ?? []) {
    if (e.resolution !== "open" || e.severity !== "critical" || e.category !== "connection")
      continue;
    const seen = out.get(e.connection_id);
    if (!seen || e.started_at > seen.at)
      out.set(e.connection_id, { at: e.started_at, message: e.message, code: e.error_code });
  }
  return out;
}

/** Whole days since `iso`, never negative. */
const daysSince = (iso: string, now: Date) =>
  Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / DAY_MS));

/** The failure's cause without the server's address in front: "no such host". */
export function failureReason(f: Failure, serverUrl?: string | null): string {
  const message = f.message.trim();
  const prefix = serverUrl ? `${serverUrl}: ` : "";
  const reason = prefix && message.startsWith(prefix) ? message.slice(prefix.length) : message;
  return reason || f.code;
}

const names = (items: { name: string }[], max = 3) =>
  items.length > max
    ? `${items
        .slice(0, max)
        .map((i) => i.name)
        .join(", ")} +${items.length - max}`
    : items.map((i) => i.name).join(", ");

/** The LDAP set-up item: failing its connection check, connected, a draft, or not set up. */
export function ldapItem(
  ldap: LdapConnection[],
  formatDate: (iso: string) => string,
  failing: ReadonlyMap<string, Failure> = new Map(),
  now: Date = new Date(),
): SetupItem {
  const base = { id: "ldap", name: "dashboard:overview.setup.items.ldap" as const };
  const to = "/auth/connections/ldap";
  const broken = ldap.filter((c) => failing.has(c.id) && c.status !== "disabled");
  const firstBroken = broken[0];
  if (firstBroken) {
    const days = daysSince(failing.get(firstBroken.id)?.at ?? "", now);
    return {
      ...base,
      state: "failing",
      detail: {
        key: days
          ? "dashboard:overview.setup.details.checkFailing"
          : "dashboard:overview.setup.details.checkFailingToday",
        params: { names: names(broken, 1), count: days },
      },
      action: { label: "dashboard:overview.setup.actions.fix", to },
    };
  }
  const active = ldap.filter((c) => c.status === "active");
  if (active.length)
    return {
      ...base,
      state: "done",
      detail: {
        key: "dashboard:overview.setup.details.connected",
        params: { names: names(active, 2) },
      },
    };
  const draft = ldap.filter((c) => c.status === "draft");
  const firstDraft = draft[0];
  if (firstDraft)
    return {
      ...base,
      state: "setup",
      detail: {
        key: "dashboard:overview.setup.details.draftSince",
        params: { names: names(draft, 1), date: formatDate(firstDraft.created_at) },
      },
      action: { label: "dashboard:overview.setup.actions.finish", to },
    };
  return {
    ...base,
    state: "none",
    detail: { key: "dashboard:overview.setup.details.ldapNone" },
    action: { label: "dashboard:overview.setup.actions.setUp", to },
  };
}

// ── Groups ───────────────────────────────────────────────────────────────────────────────────

/** The Groups set-up item: none yet, some with no members, or all in use. */
export function groupsItem(groups: Group[]): SetupItem {
  const base = { id: "groups", name: "dashboard:overview.setup.items.groups" as const };
  const empty = groups.filter((g) => g.member_count === 0);
  if (!groups.length)
    return {
      ...base,
      state: "none",
      detail: { key: "dashboard:overview.setup.details.groupsNone" },
      action: { label: "dashboard:overview.setup.actions.create", to: "/groups" },
    };
  if (empty.length)
    return {
      ...base,
      state: "attention",
      detail:
        empty.length === groups.length
          ? {
              key: "dashboard:overview.setup.details.groupsAllEmpty",
              params: { count: groups.length },
            }
          : {
              key: "dashboard:overview.setup.details.groupsEmpty",
              params: { count: empty.length, groups: groups.length },
            },
      action: { label: "dashboard:overview.setup.actions.addMembers", to: "/groups" },
    };
  return {
    ...base,
    state: "done",
    detail: { key: "dashboard:overview.setup.details.groups", params: { count: groups.length } },
  };
}

// ── Needs attention ─────────────────────────────────────────────────────────────────────────

/**
 * The alerts the area overviews used to carry: a directory connection that can't reach its server,
 * groups no one is in, and authorization risks (wildcard permissions, allow policies with no
 * condition). Each appears only when it's found.
 */
export function directoryAttention(input: {
  errors?: DirectoryErrorPage;
  connections?: DirectoryConnection[];
  groups?: Group[];
  findings?: PostureFinding[];
  now?: Date;
}): OverviewAttention[] {
  const now = input.now ?? new Date();
  const items: OverviewAttention[] = [];
  const failing = failingConnections(input.errors);
  for (const c of input.connections ?? []) {
    const f = failing.get(c.id);
    if (!f || c.status === "disabled") continue;
    const days = daysSince(f.at, now);
    items.push({
      id: `directory-down-${c.id}`,
      severity: "critical",
      title: "dashboard:overview.attention.directoryDown.title",
      detail: days
        ? "dashboard:overview.attention.directoryDown.detail"
        : "dashboard:overview.attention.directoryDown.detailToday",
      params: {
        name: c.name,
        type: c.type.toUpperCase(),
        count: days,
        reason: failureReason(f, c.serverUrl),
      },
      to: "/directory/connections",
      actionLabel: "dashboard:overview.attention.directoryDown.action",
      since: f.at,
    });
  }
  const empty = (input.groups ?? []).filter((g) => g.member_count === 0);
  if (empty.length)
    items.push({
      id: "groups-empty",
      severity: "warning",
      title: "dashboard:overview.attention.groupsEmpty.title",
      detail: "dashboard:overview.attention.groupsEmpty.detail",
      params: { count: empty.length, names: names(empty) },
      to: "/groups",
      actionLabel: "dashboard:overview.attention.groupsEmpty.action",
    });
  const found = (id: PostureFinding["id"]) =>
    input.findings?.find((f) => f.id === id && f.count > 0)?.count;
  const wildcard = found("wildcard");
  if (wildcard)
    items.push({
      id: "authz-wildcard",
      severity: "warning",
      title: "dashboard:overview.attention.wildcard.title",
      detail: "dashboard:overview.attention.wildcard.detail",
      params: { count: wildcard },
      to: "/authorization/permissions",
      actionLabel: "dashboard:overview.attention.wildcard.action",
    });
  const allowAll = found("unconditional");
  if (allowAll)
    items.push({
      id: "authz-allow-all",
      severity: "warning",
      title: "dashboard:overview.attention.allowAll.title",
      detail: "dashboard:overview.attention.allowAll.detail",
      params: { count: allowAll },
      to: "/authorization/abac",
      actionLabel: "dashboard:overview.attention.allowAll.action",
    });
  return items;
}

// ── The organisation's shape ────────────────────────────────────────────────────────────────

const field = (u: Pick<User, "metadata">, key: string) => {
  const v = u.metadata?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

/** A department and its teams; `name` null is the people with no department, `team` null no team. */
export type OrgDepartment = {
  name: string | null;
  count: number;
  teams: { team: string | null; count: number }[];
};

/**
 * Departments and the teams within them, biggest first, from what each person's profile says.
 * People without a team are their department's own tile; people without a department are one
 * tile of their own, last.
 */
export function orgShape(people: readonly Pick<User, "metadata">[]) {
  const depts = new Map<string | null, Map<string | null, number>>();
  for (const p of people) {
    const dept = field(p, "department");
    const team = dept ? field(p, "team") : null;
    const teams = depts.get(dept) ?? new Map<string | null, number>();
    teams.set(team, (teams.get(team) ?? 0) + 1);
    depts.set(dept, teams);
  }
  const departments: OrgDepartment[] = [...depts]
    .map(([name, teams]) => ({
      name,
      count: [...teams.values()].reduce((a, b) => a + b, 0),
      teams: [...teams]
        .map(([team, count]) => ({ team, count }))
        .sort((a, b) => b.count - a.count || (a.team ? -1 : 1)),
    }))
    .sort(
      (a, b) =>
        Number(a.name === null) - Number(b.name === null) ||
        b.count - a.count ||
        (a.name ?? "").localeCompare(b.name ?? ""),
    );
  const named = departments.filter((d) => d.name !== null);
  return {
    departments,
    /** How many departments people are in. */
    named: named.length,
    noTeam: named.reduce((a, d) => a + (d.teams.find((t) => t.team === null)?.count ?? 0), 0),
    noDepartment: departments.find((d) => d.name === null)?.count ?? 0,
  };
}

/** Where people work: each country with its cities, from "City, CC" locations, biggest first. */
export function placesByCountry(people: readonly Pick<User, "metadata">[]) {
  const countries = new Map<string, Map<string, number>>();
  for (const p of people) {
    const location = field(p, "location");
    if (!location) continue;
    const parts = location.split(",").map((s) => s.trim());
    const city = parts[0] ?? location;
    const country = parts.length > 1 ? (parts.at(-1) ?? "") : "";
    const cities = countries.get(country) ?? new Map<string, number>();
    cities.set(city, (cities.get(city) ?? 0) + 1);
    countries.set(country, cities);
  }
  return [...countries]
    .map(([country, cities]) => ({
      country,
      count: [...cities.values()].reduce((a, b) => a + b, 0),
      cities: [...cities]
        .map(([city, count]) => ({ city, count }))
        .sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.count - a.count);
}

export type Rect = { x: number; y: number; w: number; h: number };

/**
 * A squarified treemap (Bruls, Huizing and van Wijk): rectangles near square, in value order.
 * Until QTRX-24 brings a treemap to the library.
 */
export function squarify(values: readonly number[], rect: Rect): Rect[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (!total) return values.map(() => ({ ...rect, w: 0, h: 0 }));
  const area = rect.w * rect.h;
  const sizes = values.map((v) => (v / total) * area);
  const out: Rect[] = [];
  const worst = (row: number[], side: number) => {
    const s = row.reduce((a, b) => a + b, 0);
    return Math.max(
      (side * side * Math.max(...row)) / (s * s),
      (s * s) / (side * side * Math.min(...row)),
    );
  };
  const place = (row: number[], r: Rect): Rect => {
    const s = row.reduce((a, b) => a + b, 0);
    if (r.w >= r.h) {
      const w = s / r.h;
      let y = r.y;
      for (const a of row) {
        out.push({ x: r.x, y, w, h: a / w });
        y += a / w;
      }
      return { x: r.x + w, y: r.y, w: r.w - w, h: r.h };
    }
    const h = s / r.w;
    let x = r.x;
    for (const a of row) {
      out.push({ x, y: r.y, w: a / h, h });
      x += a / h;
    }
    return { x: r.x, y: r.y + h, w: r.w, h: r.h - h };
  };
  let r = rect;
  let row: number[] = [];
  for (let i = 0; i < sizes.length; ) {
    const next = [...row, sizes[i] ?? 0];
    const side = Math.min(r.w, r.h);
    if (!row.length || worst(next, side) <= worst(row, side)) {
      row = next;
      i++;
    } else {
      r = place(row, r);
      row = [];
    }
  }
  if (row.length) place(row, r);
  return out;
}
