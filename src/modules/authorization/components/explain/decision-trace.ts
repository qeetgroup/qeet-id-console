// A decision's trace as steps a person can read: where each was checked, what, and what it came to.
// The server writes its trace in English (decide.go composes the engines; abac.go writes each
// policy's line). The console never shows it as written: anchored patterns turn each line it
// knows into catalogue keys, and a line it doesn't know reads as a generic step.

import i18n, { type TranslationKey } from "@/i18n";

export type TraceTone = "neutral" | "success" | "danger" | "warning";

/** One step: where it was checked ("ABAC · priority 600 · deny"), what, and what it came to. */
export interface TraceStep {
  where: string;
  title: string;
  outcome: string;
  tone: TraceTone;
  /** The ABAC policy the step names, when it names one by name. */
  policyName?: string;
}

const t = (key: TranslationKey, values?: Record<string, unknown>) => i18n.t(key, values);

// Go %q strings: quotes and backslashes are escaped, which JSON reads the same way.
const QUOTED = String.raw`"((?:[^"\\]|\\.)*)"`;
function unquote(inner: string): string {
  try {
    return JSON.parse(`"${inner}"`) as string;
  } catch {
    return inner;
  }
}

// Engine names are protocol names, so they show as written.
const ENGINE = { abac: "ABAC", rbac: "RBAC", rebac: "ReBAC" } as const;

function effectWord(effect: string): string {
  return effect === "deny"
    ? t("authorization:trace.effect.deny")
    : t("authorization:trace.effect.allow");
}

function policyWhere(effect: string, priority: string): string {
  return t("authorization:trace.policyWhere", { priority, effect: effectWord(effect) });
}

/** One line of abac.go's own trace: a policy's outcome, a condition error, or the default. */
function abacStep(line: string, composed: boolean): TraceStep | null {
  let m = line.match(
    new RegExp(String.raw`^policy ${QUOTED} \(effect=(allow|deny), priority=(-?\d+)\): (.+)$`),
  );
  if (m) {
    const [, name = "", effect = "allow", priority = "0", outcome = ""] = m;
    const policyName = unquote(name);
    const where = policyWhere(effect, priority);
    const step = (key: TranslationKey, tone: TraceTone): TraceStep => ({
      where,
      title: policyName,
      outcome: t(key, { effect: effectWord(effect) }),
      tone,
      policyName,
    });
    if (outcome === "condition not matched")
      return step("authorization:trace.outcome.notMatched", "neutral");
    if (outcome === `condition matched → ${effect}`)
      return step("authorization:trace.outcome.matched", effect === "deny" ? "danger" : "success");
    if (outcome === `an attribute the condition compares is absent → ${effect}`)
      return step("authorization:trace.outcome.absentApplies", "danger");
    if (outcome === "an attribute the condition compares is absent → not matched")
      return step("authorization:trace.outcome.absentNotMatched", "neutral");
    return null;
  }
  // The evaluation error after the name is internal, so it is never read.
  m = line.match(new RegExp(`^policy ${QUOTED}: condition error`));
  if (m) {
    const policyName = unquote(m[1] ?? "");
    return {
      where: ENGINE.abac,
      title: policyName,
      outcome: t("authorization:trace.outcome.conditionError"),
      tone: "danger",
      policyName,
    };
  }
  if (line === "no matching allow policy found → default deny") {
    // Composed, a default deny decides nothing: roles and relationships still may allow.
    return composed
      ? {
          where: ENGINE.abac,
          title: t("authorization:trace.noAllowPolicy"),
          outcome: t("authorization:trace.outcome.noDecision"),
          tone: "neutral",
        }
      : {
          where: ENGINE.abac,
          title: t("authorization:trace.noAllowPolicy"),
          outcome: t("authorization:trace.outcome.deniedByDefault"),
          tone: "danger",
        };
  }
  return null;
}

/** One line of decide.go's composed trace, each prefixed with the model that wrote it. */
function composedStep(line: string): TraceStep | null {
  if (line === "tenant: no organisation, refused")
    return {
      where: t("authorization:trace.organisation"),
      title: t("authorization:trace.noOrganisation"),
      outcome: t("authorization:trace.outcome.refused"),
      tone: "danger",
    };
  if (line.startsWith("tenant: "))
    return {
      where: t("authorization:trace.organisation"),
      title: t("authorization:trace.thisOrganisation"),
      outcome: t("authorization:trace.outcome.checked"),
      tone: "neutral",
    };
  if (line === "none: nothing allows it, refused")
    return {
      where: t("authorization:trace.result"),
      title: t("authorization:trace.nothingAllows"),
      outcome: t("authorization:trace.outcome.deniedByDefault"),
      tone: "danger",
    };
  const engine = line.match(/^(abac|rbac|rebac): (.*)$/);
  if (!engine) return null;
  const model = (engine[1] ?? "abac") as keyof typeof ENGINE;
  const rest = engine[2] ?? "";
  if (/^error, refused\b/.test(rest))
    return {
      where: ENGINE[model],
      title: t("authorization:trace.engineError"),
      outcome: t("authorization:trace.outcome.refused"),
      tone: "danger",
    };
  if (model === "abac") {
    if (rest === "no policy can change this, skipped")
      return {
        where: ENGINE.abac,
        title: t("authorization:trace.abacSkipped"),
        outcome: t("authorization:trace.outcome.skipped"),
        tone: "neutral",
      };
    if (rest === "attribute policies evaluated")
      return {
        where: ENGINE.abac,
        title: t("authorization:trace.abacHidden"),
        outcome: t("authorization:trace.outcome.checked"),
        tone: "neutral",
      };
    const allowed = rest.match(
      new RegExp(String.raw`^allowed by policy ${QUOTED} \(priority (-?\d+)\), allowed$`),
    );
    if (allowed) {
      const policyName = unquote(allowed[1] ?? "");
      return {
        where: policyWhere("allow", allowed[2] ?? "0"),
        title: policyName,
        outcome: t("authorization:trace.outcome.allowed"),
        tone: "success",
        policyName,
      };
    }
    return abacStep(rest, true);
  }
  if (model === "rbac") {
    const grant = rest.match(/^a role grants (.+), allowed$/);
    if (grant)
      return {
        where: ENGINE.rbac,
        title: t("authorization:trace.roleGrants", { permission: grant[1] }),
        outcome: t("authorization:trace.outcome.allowed"),
        tone: "success",
      };
    const none = rest.match(/^no role grants (.+)$/);
    if (none)
      return {
        where: ENGINE.rbac,
        title: t("authorization:trace.noRoleGrants", { permission: none[1] }),
        outcome: t("authorization:trace.outcome.notGranted"),
        tone: "neutral",
      };
    return null;
  }
  const grant = rest.match(/^(.+) on (.+), allowed$/);
  if (grant)
    return {
      where: ENGINE.rebac,
      title: t("authorization:trace.relationOn", { relation: grant[1], object: grant[2] }),
      outcome: t("authorization:trace.outcome.allowed"),
      tone: "success",
    };
  const none = rest.match(/^no (.+) on (.+)$/);
  if (none)
    return {
      where: ENGINE.rebac,
      title: t("authorization:trace.noRelationOn", { relation: none[1], object: none[2] }),
      outcome: t("authorization:trace.outcome.notGranted"),
      tone: "neutral",
    };
  return null;
}

const UNKNOWN = (): TraceStep => ({
  where: "",
  title: t("authorization:trace.unknown"),
  outcome: "",
  tone: "neutral",
});

/**
 * Returns a trace as readable steps. `composed` is a check across the engines (decide.go: every
 * line carries its model); otherwise the lines are the attribute policies' own (POST /abac/evaluate).
 */
export function traceSteps(trace: readonly string[] | undefined, composed: boolean): TraceStep[] {
  return (trace ?? []).map(
    (line) => (composed ? composedStep(line.trim()) : abacStep(line.trim(), false)) ?? UNKNOWN(),
  );
}
