import { Field } from "@qeetrix/react";
import { Alert } from "@qeetrix/react/experimental";
import { useTranslation } from "react-i18next";

import { type CondNode, toConditionJson } from "@/modules/authorization/api/abac";
import type { DecisionRecord } from "@/modules/authorization/api/simulate";
import {
  explainDecision,
  explainedMessage,
} from "@/modules/authorization/components/explain/decision-reason";
import { traceSteps } from "@/modules/authorization/components/explain/decision-trace";
import { MonacoPanel } from "@/modules/authorization/components/shared/monaco-panel";
import { Answer, TraceList } from "@/modules/authorization/components/workspace/decision-parts";
import { errorMessage } from "@/platform/errors/user-message";
import type { Draft } from "./policy-draft";

/** An ABAC request as POST /abac/evaluate takes it. */
export type AbacRequest = {
  subject?: Record<string, unknown>;
  resource?: { type: string; id: string; attrs?: Record<string, unknown> };
  action?: string;
  context?: Record<string, unknown>;
};

/** Parses the request the person typed; null when it isn't a JSON object. */
export function parseRequest(raw: string): AbacRequest | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as AbacRequest)
      : null;
  } catch {
    return null;
  }
}

function leaves(node: CondNode | null): Extract<CondNode, { kind: "leaf" }>[] {
  if (!node) return [];
  if (node.kind === "leaf") return [node];
  if (node.kind === "not") return leaves(node.child);
  return node.children.flatMap(leaves);
}

/**
 * A request to start from: the policy's target, and each attribute its condition names with the
 * value it compares, so the person edits one that's about this policy rather than a blank one.
 */
export function sampleRequest(d: Draft): string {
  const subject: Record<string, unknown> = {};
  const attrs: Record<string, unknown> = {};
  const context: Record<string, unknown> = {};
  let type =
    d.resourceType.trim() && d.resourceType.trim() !== "*" ? d.resourceType.trim() : "document";
  let id = "example";
  for (const leaf of leaves(d.condition)) {
    if (leaf.ref || !leaf.attr.includes(".")) continue;
    const json = toConditionJson(leaf) as { value?: unknown };
    const value =
      leaf.op === "exists" ? true : Array.isArray(json.value) ? json.value[0] : json.value;
    if (value === undefined) continue;
    const [ns, ...rest] = leaf.attr.split(".");
    const key = rest.join(".");
    if (ns === "subject") subject[key] = value;
    else if (ns === "context") context[key] = value;
    else if (key === "type") type = String(value);
    else if (key === "id") id = String(value);
    else attrs[key] = value;
  }
  const action = d.action.trim() && d.action.trim() !== "*" ? d.action.trim() : "read";
  return JSON.stringify(
    {
      subject,
      resource: { type, id, ...(Object.keys(attrs).length ? { attrs } : {}) },
      action,
      context,
    },
    null,
    2,
  );
}

/**
 * The Test tab: a request, evaluated by the attribute engine against the organisation's saved,
 * enabled policies (POST /abac/evaluate checks stored policies only, so unsaved changes aren't in
 * it), and the decision with each policy's outcome in order.
 */
export function PolicyTest({
  request,
  onRequestChange,
  invalid,
  record,
  error,
  unsaved,
}: {
  request: string;
  onRequestChange: (raw: string) => void;
  invalid: boolean;
  record: DecisionRecord | null;
  error: unknown;
  unsaved: boolean;
}) {
  const { t } = useTranslation("authorization");
  const reason = record ? explainDecision(record) : null;
  return (
    <div className="ws-test">
      <Field
        label={t("abacTest.request")}
        error={invalid ? t("abacTest.invalidJson") : undefined}
        invalid={invalid}
        description={unsaved ? t("abacTest.unsavedHint") : t("abacTest.savedHint")}
      >
        <MonacoPanel
          value={request}
          language="json"
          readOnly={false}
          onChange={onRequestChange}
          height={168}
          ariaLabel={t("abacTest.request")}
        />
      </Field>
      <div className="ws-test-result" aria-live="polite">
        {error ? <Alert tone="danger" title={errorMessage(error)} /> : null}
        {record?.abac ? (
          <>
            <Answer
              compact
              allowed={record.allowed}
              reason={reason ? explainedMessage(reason) : t("answer.noReason")}
              meta={t("answer.meta", { engine: "ABAC", ms: record.durationMs })}
            />
            <TraceList steps={traceSteps(record.abac.trace, false)} />
          </>
        ) : error ? null : (
          <p className="ws-note">{t("abacTest.empty")}</p>
        )}
      </div>
    </div>
  );
}
