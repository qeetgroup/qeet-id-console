// What the evidence pages work out from runs: where each check's setting is changed, and how long
// a check has had its status. Pure, so it's tested on its own.

import type { ControlResult, ControlStatus, EvidenceRun } from "./api/evidence";

/** The console page where a check's setting is changed; a key under `fix.` in the catalogue. */
export type FixPlace =
  | "securitySettings"
  | "password"
  | "risk"
  | "roles"
  | "ipRules"
  | "secrets"
  | "logStreams"
  | "retention"
  | "gdpr"
  | "auditLogs";

// By the end of the control's stable id (gdpr/evidence.go): each reads one table, and these are the
// pages that change it. MFA and session age are the security policy (tenant.security_policies);
// password rules are the auth policy (tenant.auth_policy), changed on Sign-in › Password.
const FIXES: { match: RegExp; place: FixPlace; to: string }[] = [
  {
    match: /-(MFA|SESSION)$/,
    place: "securitySettings",
    to: "/settings/organization/security-policy",
  },
  { match: /-PWD-(LEN|CMPLX)$/, place: "password", to: "/auth/login-methods/password" },
  { match: /-BREACH$/, place: "risk", to: "/security/threats/risk-settings" },
  { match: /-RBAC(-ROLES|-ASSIGN)?$/, place: "roles", to: "/authorization/roles" },
  { match: /-(IP-ACL|IP)$/, place: "ipRules", to: "/security/threats/ip-allowlist" },
  { match: /-(SECRETS|ENCRYPT)$/, place: "secrets", to: "/auth/api/secrets" },
  { match: /-SIEM$/, place: "logStreams", to: "/security/log-streaming" },
  { match: /-RETAIN$/, place: "retention", to: "/security/compliance/retention" },
  { match: /-GDPR$/, place: "gdpr", to: "/security/compliance/gdpr" },
  { match: /-(CHAIN|ACTIVE|AUDIT)$/, place: "auditLogs", to: "/security/audit-logs" },
];

export function fixFor(controlId: string): { place: FixPlace; to: string } | null {
  const fix = FIXES.find((f) => f.match.test(controlId));
  return fix ? { place: fix.place, to: fix.to } : null;
}

/** How many runs back (newest first) the "since" lines look; past it they say "each of the last". */
export const HISTORY_RUNS = 12;

export type Streak = {
  /** Runs in a row, from this one back, with the same status. */
  runs: number;
  /** When the oldest of them was generated. */
  since: string;
  /** The streak reaches the first run on record. */
  everyRun: boolean;
  /** The streak reaches the last run looked at, and there are older ones. */
  capped: boolean;
  /** The status in the run before the streak, when there is one. */
  before?: ControlStatus;
};

/**
 * How long `controlId` has had its status in `runs[0]`. `runs` are this run and the ones before it,
 * newest first, as far as they were read; `total` is how many runs exist from this one back.
 */
export function streakOf(
  runs: readonly (EvidenceRun | undefined)[],
  controlId: string,
  total: number,
): Streak | null {
  const status = (run?: EvidenceRun) => run?.controls?.find((c) => c.id === controlId)?.status;
  const first = runs[0];
  const now = status(first);
  if (!first || !now) return null;
  let n = 1;
  while (n < runs.length && runs[n] && status(runs[n]) === now) n++;
  const oldest = runs[n - 1] ?? first;
  const reachedEnd = n === runs.length;
  return {
    runs: n,
    since: oldest.generated_at,
    everyRun: reachedEnd && n === total,
    capped: reachedEnd && n < total,
    before: reachedEnd ? undefined : status(runs[n]),
  };
}

/** The checks that didn't pass, failing first, in the server's order otherwise. */
export function missingOf(controls: readonly ControlResult[]): ControlResult[] {
  const rank = (s: ControlStatus) => (s === "fail" ? 0 : 1);
  return controls
    .filter((c) => c.status !== "pass")
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c.status) - rank(b.c.status) || a.i - b.i)
    .map(({ c }) => c);
}

/** The distinct pages that fix the failing checks. */
export function fixPlaces(controls: readonly ControlResult[]): number {
  return new Set(
    controls.filter((c) => c.status === "fail").map((c) => fixFor(c.id)?.place ?? c.id),
  ).size;
}

/** A control's status in a run, by its id (the same check across runs and frameworks' runs). */
export function statusIn(
  run: EvidenceRun | undefined,
  controlId: string,
): ControlStatus | undefined {
  return run?.controls?.find((c) => c.id === controlId)?.status;
}
