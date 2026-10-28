import { Badge } from "@qeetrix/react";
import { useTranslation } from "react-i18next";

import type { AbacPolicy, ConditionJson } from "@/modules/authorization/api/abac";
import { type Draft, isAlways } from "./policy-draft";

/** Every attribute a stored condition compares, including the ones it compares with. */
export function conditionAttributes(json: ConditionJson | null | undefined): string[] {
  if (!json || isAlways(json)) return [];
  if ("all" in json) return json.all.flatMap(conditionAttributes);
  if ("any" in json) return json.any.flatMap(conditionAttributes);
  if ("not" in json) return conditionAttributes(json.not);
  const value = json.value as { attr?: unknown } | undefined;
  const other =
    value && typeof value === "object" && typeof value.attr === "string" ? [value.attr] : [];
  return typeof json.attr === "string" ? [json.attr, ...other] : other;
}

/** Whether a policy matches a search: its name, target, description or any attribute it names. */
export function matchesSearch(p: AbacPolicy, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [p.name, p.resource_type, p.action, p.description, ...conditionAttributes(p.condition)]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

type Row = { key: string; draft?: Draft; policy?: AbacPolicy };

/**
 * The policies in the order the engine checks them: highest priority first (the server lists them
 * so, then by name). An unsaved new policy takes its place by its priority. The end row says what
 * happens when none matches.
 */
export function PolicyList({
  policies,
  draft,
  currentId,
  onOpen,
}: {
  policies: readonly AbacPolicy[];
  draft: Draft | null;
  currentId: string | null;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation("authorization");
  const rows: Row[] = policies.map((p) => ({ key: p.id, policy: p }));
  if (draft && !draft.id) {
    const at = rows.findIndex((r) => (r.policy?.priority ?? 0) < draft.priority);
    rows.splice(at === -1 ? rows.length : at, 0, { key: "new", draft });
  }
  const target = (v: string) => (!v.trim() || v.trim() === "*" ? t("rule.any") : v);
  return (
    <ul className="ws-list ws-order">
      {rows.map(({ key, draft: d, policy: p }) => {
        const name = d ? d.name.trim() || t("abac.newPolicy") : (p?.name ?? "");
        const effect = d?.effect ?? p?.effect ?? "allow";
        const priority = d?.priority ?? p?.priority ?? 0;
        const always = d ? !d.condition : isAlways(p?.condition);
        return (
          <li key={key}>
            <button
              type="button"
              className="ws-row"
              aria-current={currentId === key ? "true" : undefined}
              onClick={() => onOpen(key)}
            >
              <span className="ws-priority">{priority}</span>
              <span className="ws-row-text ws-wrap">
                <strong>{name}</strong>
                <small className="ws-row-line">
                  {d ? (
                    <Badge size="sm" tone="info">
                      {t("abac.notSaved")}
                    </Badge>
                  ) : p && !p.enabled ? (
                    <Badge size="sm">{t("abac.off")}</Badge>
                  ) : null}
                  <span className="ws-effect">
                    {effect === "deny" ? t("rule.deny") : t("rule.allow")}
                  </span>
                  <span>
                    · {target(d?.resourceType ?? p?.resource_type ?? "*")} ·{" "}
                    {target(d?.action ?? p?.action ?? "*")}
                    {always ? ` · ${t("abac.always")}` : ""}
                  </span>
                </small>
              </span>
            </button>
          </li>
        );
      })}
      <li className="ws-order-end">
        <span className="ws-priority" aria-hidden="true">
          —
        </span>
        <span className="ws-row-text">
          <strong>{t("abac.noneMatched")}</strong>
          <small>{t("abac.noneMatchedHint")}</small>
        </span>
      </li>
    </ul>
  );
}
