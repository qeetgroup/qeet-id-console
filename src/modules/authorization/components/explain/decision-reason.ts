// Why a decision came out as it did, in the reader's language. The server states it as a stable
// reason code (QTID-951) and, for older servers only, as an English sentence; the code wins, and
// anchored patterns map the sentences the console knows. Server text is never shown as written:
// it may carry internal detail, such as the evaluation error behind a condition that failed.

import i18n, { type TranslationKey } from "@/i18n";
import type { Effect } from "@/modules/authorization/api/abac";
import type { DecidedBy, ReasonFields, ReasonParams } from "@/modules/authorization/api/decision";
import type { DecisionRecord } from "@/modules/authorization/api/simulate";

type Values = {
  name?: string;
  priority?: string;
  permission?: string;
  relation?: string;
  object?: string;
};

/** A server explanation as a catalogue key and the values it interpolates. */
export interface ExplainedText extends Values {
  key: TranslationKey;
  effect?: Effect; // raw; explainedMessage translates it
}

const UNKNOWN_REASON: TranslationKey = "authorization:decisionExplain.reason.unknown";

// Each code's sentence, the params it needs, and the sentence for when they are absent: a caller
// who may not read policies gets no policy name.
const REASON_CODES: Record<
  string,
  { key: TranslationKey; needs?: (keyof Values)[]; without?: TranslationKey }
> = {
  "authz.allowed_by_policy": {
    key: "authorization:decisionExplain.reason.allowed",
    needs: ["name", "priority"],
    without: "authorization:decisionExplain.reason.allowedUnnamed",
  },
  "authz.denied_by_policy": {
    key: "authorization:decisionExplain.reason.explicitDeny",
    needs: ["name", "priority"],
    without: "authorization:decisionExplain.reason.explicitDenyUnnamed",
  },
  "authz.attribute_absent": {
    key: "authorization:decisionExplain.reason.absentDeny",
    needs: ["name", "priority"],
    without: "authorization:decisionExplain.reason.absentDenyUnnamed",
  },
  "authz.condition_error": {
    key: "authorization:decisionExplain.reason.conditionError",
    needs: ["name"],
    without: "authorization:decisionExplain.reason.conditionErrorUnnamed",
  },
  "authz.no_matching_allow": { key: "authorization:decisionExplain.reason.noAllow" },
  "authz.no_role_grant": { key: "authorization:check.deniedReason" },
  "authz.role_grant": {
    key: "authorization:decisionExplain.reason.roleGrant",
    needs: ["permission"],
    without: "authorization:decisionExplain.reason.roleGrantUnnamed",
  },
  "authz.relation_grant": {
    key: "authorization:decisionExplain.reason.relationGrant",
    needs: ["relation", "object"],
    without: "authorization:decisionExplain.reason.relationGrantUnnamed",
  },
  "authz.nothing_allows": { key: "authorization:decisionExplain.reason.nothingAllows" },
  "authz.no_tenant": { key: "authorization:decisionExplain.reason.noTenant" },
  "authz.engine_error": { key: "authorization:decisionExplain.reason.engineError" },
};

// Reads the params the server sent, keeping only well-typed values.
function valuesOf(params: ReasonParams | undefined): Values {
  const p: Record<string, unknown> = { ...params };
  const text = (v: unknown) => (typeof v === "string" && v !== "" ? v : undefined);
  return {
    name: text(p.policy_name),
    priority: typeof p.priority === "number" ? String(p.priority) : undefined,
    permission: text(p.permission),
    relation: text(p.relation),
    object: text(p.object),
  };
}

/** Returns a reason code's sentence as a catalogue key; an unknown code reads as a generic line. */
export function explainCode(code: string, params?: ReasonParams): ExplainedText {
  const known = Object.hasOwn(REASON_CODES, code) ? REASON_CODES[code] : undefined;
  if (!known) return { key: UNKNOWN_REASON };
  const values = valuesOf(params);
  const complete = (known.needs ?? []).every((k) => values[k] !== undefined);
  return complete ? { key: known.key, ...values } : { key: known.without ?? known.key };
}

// Policy names arrive as Go %q strings, "((?:[^"\\]|\\.)*)": quotes and backslashes are escaped.
// Each pattern captures the name first, then the priority or the policy's effect and priority.
type Rule = [RegExp, (m: RegExpMatchArray) => ExplainedText];

// Returns the text of a %q string; JSON shares its escapes for any printable name.
function unquote(inner: string): string {
  try {
    return JSON.parse(`"${inner}"`) as string;
  } catch {
    return inner;
  }
}

function named(key: TranslationKey): (m: RegExpMatchArray) => ExplainedText {
  return (m) => ({ key, name: unquote(m[1] ?? ""), priority: m[2] });
}

function policyStep(key: TranslationKey): (m: RegExpMatchArray) => ExplainedText {
  return (m) => ({ key, name: unquote(m[1] ?? ""), effect: m[2] as Effect, priority: m[3] });
}

// The sentences an older server sends in place of a code.
const REASONS: Rule[] = [
  [
    /^no role grants this permission for this user in this tenant$/,
    () => ({ key: "authorization:check.deniedReason" }),
  ],
  [
    /^explicitly denied by policy "((?:[^"\\]|\\.)*)" \(priority (-?\d+)\)$/,
    named("authorization:decisionExplain.reason.explicitDeny"),
  ],
  [
    /^denied by policy "((?:[^"\\]|\\.)*)" \(priority (-?\d+)\): an attribute it compares is absent$/,
    named("authorization:decisionExplain.reason.absentDeny"),
  ],
  [
    /^allowed by policy "((?:[^"\\]|\\.)*)" \(priority (-?\d+)\)$/,
    named("authorization:decisionExplain.reason.allowed"),
  ],
  [/^no matching allow policy$/, () => ({ key: "authorization:decisionExplain.reason.noAllow" })],
  // Any evaluation error after the name is internal, so it is never read.
  [
    /^condition error in policy "((?:[^"\\]|\\.)*)"(?::|$)/,
    named("authorization:decisionExplain.reason.conditionError"),
  ],
];

const TRACE_STEPS: Rule[] = [
  [
    /^policy "((?:[^"\\]|\\.)*)" \(effect=(allow|deny), priority=(-?\d+)\): condition not matched$/,
    policyStep("authorization:decisionExplain.trace.notMatched"),
  ],
  [
    /^policy "((?:[^"\\]|\\.)*)" \(effect=(allow|deny), priority=(-?\d+)\): condition matched → \2$/,
    policyStep("authorization:decisionExplain.trace.matched"),
  ],
  [
    /^policy "((?:[^"\\]|\\.)*)" \(effect=(allow|deny), priority=(-?\d+)\): an attribute the condition compares is absent → \2$/,
    policyStep("authorization:decisionExplain.trace.absentApplies"),
  ],
  [
    /^policy "((?:[^"\\]|\\.)*)" \(effect=(allow|deny), priority=(-?\d+)\): an attribute the condition compares is absent → not matched$/,
    policyStep("authorization:decisionExplain.trace.absentNotMatched"),
  ],
  [
    /^policy "((?:[^"\\]|\\.)*)": condition error(?: \([\s\S]*\))? → fail-closed deny$/,
    named("authorization:decisionExplain.trace.conditionError"),
  ],
  [
    /^no matching allow policy found → default deny$/,
    () => ({ key: "authorization:decisionExplain.trace.defaultDeny" }),
  ],
];

function match(rules: Rule[], text: string): ExplainedText | null {
  for (const [pattern, explain] of rules) {
    const m = text.match(pattern);
    if (m) return explain(m);
  }
  return null;
}

/** Returns a known reason sentence as a catalogue key, or null for one the console can't vouch for. */
export function explainReason(reason: string): ExplainedText | null {
  return match(REASONS, reason.trim());
}

/** Returns why a check came out as it did: by its code, else by its sentence; null for neither. */
export function explainReasonFields({
  reason,
  reason_code,
  reason_params,
}: ReasonFields): ExplainedText | null {
  if (reason_code) return explainCode(reason_code, reason_params);
  if (reason) return explainReason(reason) ?? { key: UNKNOWN_REASON };
  return null;
}

/** Returns the summary of a check's `decided_by`, or null when it states no code. */
export function explainDecidedBy(decidedBy: DecidedBy | undefined): ExplainedText | null {
  const code = decidedBy?.reason_code;
  return typeof code === "string" && code ? explainCode(code, decidedBy?.reason_params) : null;
}

/** Returns a decision's summary: the engine's own reason first, then the check's decided_by. */
export function explainDecision(record: DecisionRecord): ExplainedText | null {
  const own = record.abac ?? record.rbac;
  const decidedBy =
    record.rbac?.decided_by ?? record.rebac?.decided_by ?? record.authzen?.context?.decided_by;
  return (
    explainReasonFields({
      reason: record.reason,
      reason_code: own?.reason_code,
      reason_params: own?.reason_params,
    }) ?? explainDecidedBy(decidedBy)
  );
}

/** Returns an ABAC trace step as a catalogue key; an unknown step reads as a generic line. */
export function explainTraceStep(step: string): ExplainedText {
  return match(TRACE_STEPS, step.trim()) ?? { key: "authorization:decisionExplain.trace.unknown" };
}

/** Renders an explanation; a raw effect reads in the reader's language. */
export function explainedMessage({ key, effect, ...values }: ExplainedText): string {
  return i18n.t(key, {
    ...values,
    effect: effect ? i18n.t(`authorization:decisionExplain.effect.${effect}`) : undefined,
  });
}
