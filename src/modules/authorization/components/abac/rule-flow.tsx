import { NetworkIcon, PlusIcon, ShieldCheckIcon } from "@qeetrix/icons";
import { Badge, Button, Toggle, ToggleGroup } from "@qeetrix/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import i18n from "@/i18n";

import { type CondNode, OPERATOR_LABELS } from "@/modules/authorization/api/abac";
import { GroupLabel } from "@/modules/authorization/components/workspace/workspace";
import type { Draft } from "./policy-draft";

/** What the canvas can select: the target, the effect, a template block, or a condition node. */
export type Selection = "target" | "effect" | "role" | "relation" | (string & {});

export type RuleFlowProps = {
  draft: Draft;
  selected: Selection | null;
  onSelect: (id: Selection) => void;
  /** Absent when the reader can't change policies: the canvas is then read-only. */
  edit?: {
    onAdd: (kind: "condition" | "group") => void;
    onCombinator: (groupId: string, combinator: "all" | "any") => void;
  };
};

/**
 * A policy drawn as the statement the engine evaluates: APPLIES TO its target, WHEN its condition
 * matches, THEN its effect, on one spine, with nested All / Any / Not groups as ruled branches.
 * Selecting a part gives it the Ember bar and opens it in the inspector. It replaces the free-drag
 * node canvas (positions meant nothing and weren't saved) and the separate evaluation tree.
 */
export function RuleFlow({ draft, selected, onSelect, edit }: RuleFlowProps) {
  const { t } = useTranslation("authorization");
  const target = (v: string) =>
    !v.trim() || v.trim() === "*" ? (
      <span className="rule-any">{t("rule.any")}</span>
    ) : (
      <code>{v}</code>
    );
  return (
    <ol className="rule" aria-label={t("rule.label")}>
      <li className="rule-step">
        <GroupLabel>{t("rule.appliesTo")}</GroupLabel>
        <Part id="target" selected={selected} onSelect={onSelect}>
          <span className="rule-pair">
            <small>{t("rule.resource")}</small>
            {target(draft.resourceType)}
          </span>
          <span className="rule-pair">
            <small>{t("rule.action")}</small>
            {target(draft.action)}
          </span>
        </Part>
      </li>
      <li className="rule-step">
        <GroupLabel>{t("rule.when")}</GroupLabel>
        <div className="rule-when">
          {draft.requireRole != null ? (
            <Part id="role" selected={selected} onSelect={onSelect}>
              <ShieldCheckIcon size={16} aria-hidden="true" className="rule-extra-icon" />
              <span className="rule-extra-text">
                {t("rule.role", { role: draft.requireRole || "…" })}
              </span>
              <Badge tone="warning" size="sm">
                {t("rule.previewOnly")}
              </Badge>
            </Part>
          ) : null}
          {draft.relation ? (
            <Part id="relation" selected={selected} onSelect={onSelect}>
              <NetworkIcon size={16} aria-hidden="true" className="rule-extra-icon" />
              <span className="rule-extra-text">
                {t("rule.relation", {
                  relation: draft.relation.relation || "…",
                  object: draft.relation.object || "…",
                })}
              </span>
              <Badge tone="warning" size="sm">
                {t("rule.previewOnly")}
              </Badge>
            </Part>
          ) : null}
          {draft.condition ? (
            <Node node={draft.condition} selected={selected} onSelect={onSelect} edit={edit} />
          ) : (
            <div className="rule-node rule-always">
              <strong>{t("rule.always")}</strong>
              <span>{t("rule.alwaysHint")}</span>
            </div>
          )}
          {edit ? (
            <div className="rule-adds">
              <Button
                variant="ghost"
                size="sm"
                icon={PlusIcon}
                onClick={() => edit.onAdd("condition")}
              >
                {t("rule.addCondition")}
              </Button>
              <Button variant="ghost" size="sm" icon={PlusIcon} onClick={() => edit.onAdd("group")}>
                {t("rule.addGroup")}
              </Button>
            </div>
          ) : null}
        </div>
      </li>
      <li className="rule-step">
        <GroupLabel>{t("rule.then")}</GroupLabel>
        <Part id="effect" selected={selected} onSelect={onSelect} className="rule-then">
          <strong className="ws-effect">
            {draft.effect === "deny" ? t("rule.deny") : t("rule.allow")}
          </strong>
          <span className="rule-then-text">
            {draft.effect === "deny" ? t("rule.denyHint") : t("rule.allowHint")}
          </span>
          <span className="rule-priority">
            <small>{t("rule.priority")}</small>
            <strong>{draft.priority}</strong>
          </span>
        </Part>
      </li>
    </ol>
  );
}

/** A selectable part of the statement: a button that names what it opens. */
function Part({
  id,
  selected,
  onSelect,
  className,
  children,
}: {
  id: Selection;
  selected: Selection | null;
  onSelect: (id: Selection) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className ? `rule-node ${className}` : "rule-node"}
      data-current={selected === id || undefined}
      aria-current={selected === id ? "true" : undefined}
      onClick={() => onSelect(id)}
    >
      {children}
    </button>
  );
}

function Node({
  node,
  selected,
  onSelect,
  edit,
  depth = 0,
}: {
  node: CondNode;
  selected: Selection | null;
  onSelect: (id: Selection) => void;
  edit?: RuleFlowProps["edit"];
  depth?: number;
}) {
  const { t } = useTranslation("authorization");
  if (node.kind === "leaf") {
    const attr = node.attr.trim();
    const op = i18n.t(OPERATOR_LABELS[node.op]);
    return (
      <button
        type="button"
        className="rule-node rule-leaf"
        data-current={selected === node.id || undefined}
        data-empty={!attr || undefined}
        aria-current={selected === node.id ? "true" : undefined}
        onClick={() => onSelect(node.id)}
      >
        {attr ? (
          <code className="rule-attr">{attr}</code>
        ) : (
          <span className="rule-missing">{t("rule.pickAttribute")}</span>
        )}
        <span className="rule-op">{op}</span>
        {node.op !== "exists" ? (
          node.ref ? (
            <code className="rule-value">{node.value || "…"}</code>
          ) : (
            <code className="rule-value">{node.value === "" ? '""' : node.value}</code>
          )
        ) : null}
      </button>
    );
  }
  if (node.kind === "not") {
    return (
      <div className="rule-group" data-current={selected === node.id || undefined}>
        <button
          type="button"
          className="rule-group-head"
          aria-current={selected === node.id ? "true" : undefined}
          onClick={() => onSelect(node.id)}
        >
          <span className="rule-group-name">{t("rule.not")}</span>
          <span className="rule-group-hint">{t("rule.notHint")}</span>
        </button>
        <div className="rule-branch">
          <Node
            node={node.child}
            selected={selected}
            onSelect={onSelect}
            edit={edit}
            depth={depth + 1}
          />
        </div>
      </div>
    );
  }
  const count = node.children.length;
  return (
    <div
      className="rule-group"
      data-root={depth === 0 || undefined}
      data-current={selected === node.id || undefined}
    >
      <div className="rule-group-head">
        {edit ? (
          <ToggleGroup
            size="sm"
            value={[node.combinator]}
            onValueChange={(v) => {
              const next = v[0];
              if (next === "all" || next === "any") edit.onCombinator(node.id, next);
            }}
            aria-label={t("rule.combine")}
          >
            <Toggle value="all">{t("rule.combineAll")}</Toggle>
            <Toggle value="any">{t("rule.combineAny")}</Toggle>
          </ToggleGroup>
        ) : (
          <span className="rule-group-name">
            {node.combinator === "all" ? t("rule.combineAll") : t("rule.combineAny")}
          </span>
        )}
        <button
          type="button"
          className="rule-group-select"
          aria-current={selected === node.id ? "true" : undefined}
          onClick={() => onSelect(node.id)}
        >
          {t("rule.ofThese", { count })}
        </button>
      </div>
      <div className="rule-branch">
        {node.children.map((c) => (
          <Node
            key={c.id}
            node={c}
            selected={selected}
            onSelect={onSelect}
            edit={edit}
            depth={depth + 1}
          />
        ))}
      </div>
    </div>
  );
}
