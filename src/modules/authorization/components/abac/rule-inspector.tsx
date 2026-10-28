import { CircleXIcon, PlusIcon, TrashIcon } from "@qeetrix/icons";
import {
  Button,
  Field,
  Select,
  Switch,
  Textarea,
  TextField,
  Toggle,
  ToggleGroup,
} from "@qeetrix/react";
import { NumberField } from "@qeetrix/react/experimental";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import i18n from "@/i18n";

import {
  type CondNode,
  type Effect,
  NULLARY_OPERATORS,
  OPERATOR_LABELS,
  OPERATORS,
  type Operator,
  REFERENCE_OPERATORS,
} from "@/modules/authorization/api/abac";
import { Section } from "@/modules/authorization/components/workspace/workspace";
import {
  addNode,
  blankGroup,
  blankLeaf,
  type Draft,
  findNode,
  parentOf,
  removeNode,
  unwrapNot,
  updateNode,
  wrapInNot,
} from "./policy-draft";
import type { Selection } from "./rule-flow";

export type FieldErrors = { name?: string; resourceType?: string; action?: string };

type Change = (next: Draft, select?: Selection | null) => void;

/** The inspector's head: the part selected on the canvas, edited here. */
export function PartEditor({
  draft,
  selected,
  onChange,
  readOnly,
  attributes,
}: {
  draft: Draft;
  selected: Selection | null;
  onChange: Change;
  readOnly: boolean;
  /** The attribute paths the organisation's policies already use, offered as suggestions. */
  attributes: readonly string[];
}) {
  const { t } = useTranslation("authorization");
  if (selected === "role" && draft.requireRole != null)
    return (
      <Section label={t("inspector.roleBlock")}>
        <p className="ws-note">{t("inspector.previewOnlyHint")}</p>
        {readOnly ? null : (
          <div className="ws-form-end">
            <Button
              variant="ghost"
              tone="danger"
              size="sm"
              icon={TrashIcon}
              onClick={() => onChange({ ...draft, requireRole: null }, "target")}
            >
              {t("inspector.removeRole")}
            </Button>
          </div>
        )}
      </Section>
    );
  if (selected === "relation" && draft.relation)
    return (
      <Section label={t("inspector.relationBlock")}>
        <p className="ws-note">{t("inspector.previewOnlyHint")}</p>
        {readOnly ? null : (
          <div className="ws-form-end">
            <Button
              variant="ghost"
              tone="danger"
              size="sm"
              icon={TrashIcon}
              onClick={() => onChange({ ...draft, relation: null }, "target")}
            >
              {t("inspector.removeRelation")}
            </Button>
          </div>
        )}
      </Section>
    );
  const node = selected ? findNode(draft.condition, selected) : null;
  if (!node || !draft.condition) return null;
  const root = draft.condition;
  const parent = parentOf(root, node.id);
  const where = !parent
    ? t("inspector.atTop")
    : parent.kind === "not"
      ? t("inspector.insideNot")
      : parent.combinator === "all"
        ? t("inspector.insideAll")
        : t("inspector.insideAny");
  const set = (fn: (n: CondNode) => CondNode) =>
    onChange({ ...draft, condition: updateNode(root, node.id, fn) });
  const remove = () =>
    onChange({ ...draft, condition: removeNode(root, node.id) }, parent?.id ?? "target");

  if (node.kind === "leaf")
    return (
      <Section label={`${t("inspector.condition")} · ${where}`}>
        <LeafFields node={node} onChange={set} readOnly={readOnly} attributes={attributes} />
        {readOnly ? null : (
          <div className="ws-form-end">
            <Button
              variant="ghost"
              tone="neutral"
              size="sm"
              icon={CircleXIcon}
              onClick={() => onChange({ ...draft, condition: wrapInNot(root, node.id) })}
            >
              {t("inspector.wrapInNot")}
            </Button>
            <Button variant="ghost" tone="danger" size="sm" icon={TrashIcon} onClick={remove}>
              {t("inspector.removeCondition")}
            </Button>
          </div>
        )}
      </Section>
    );
  if (node.kind === "not")
    return (
      <Section label={`${t("inspector.not")} · ${where}`}>
        <p className="ws-note">{t("inspector.notHint")}</p>
        {readOnly ? null : (
          <div className="ws-form-end">
            <Button
              variant="ghost"
              tone="neutral"
              size="sm"
              onClick={() => onChange({ ...draft, condition: unwrapNot(root, node.id) })}
            >
              {t("inspector.unwrapNot")}
            </Button>
            <Button variant="ghost" tone="danger" size="sm" icon={TrashIcon} onClick={remove}>
              {t("inspector.remove")}
            </Button>
          </div>
        )}
      </Section>
    );
  return (
    <Section label={`${t("inspector.group")} · ${where}`}>
      <p className="ws-note">
        {node.combinator === "all" ? t("inspector.groupAllHint") : t("inspector.groupAnyHint")}
      </p>
      {readOnly ? null : (
        <div className="ws-form-end ws-start">
          <Button
            variant="ghost"
            size="sm"
            icon={PlusIcon}
            onClick={() => {
              const leaf = blankLeaf();
              onChange({ ...draft, condition: addNode(root, leaf, node.id) }, leaf.id);
            }}
          >
            {t("inspector.addCondition")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={PlusIcon}
            onClick={() => {
              const group = blankGroup();
              onChange({ ...draft, condition: addNode(root, group, node.id) }, group.id);
            }}
          >
            {t("inspector.addGroup")}
          </Button>
        </div>
      )}
      {readOnly ? null : (
        <div className="ws-form-end">
          <Button
            variant="ghost"
            tone="neutral"
            size="sm"
            icon={CircleXIcon}
            onClick={() => onChange({ ...draft, condition: wrapInNot(root, node.id) })}
          >
            {t("inspector.wrapInNot")}
          </Button>
          <Button variant="ghost" tone="danger" size="sm" icon={TrashIcon} onClick={remove}>
            {t("inspector.removeGroup")}
          </Button>
        </div>
      )}
    </Section>
  );
}

const VALUE_HINT: Partial<Record<Operator, "list" | "pattern" | "affix">> = {
  in: "list",
  nin: "list",
  regex: "pattern",
  prefix: "affix",
  suffix: "affix",
};

function LeafFields({
  node,
  onChange,
  readOnly,
  attributes,
}: {
  node: Extract<CondNode, { kind: "leaf" }>;
  onChange: (fn: (n: CondNode) => CondNode) => void;
  readOnly: boolean;
  attributes: readonly string[];
}) {
  const { t } = useTranslation("authorization");
  const listId = useId();
  const nullary = NULLARY_OPERATORS.includes(node.op);
  const referable = REFERENCE_OPERATORS.includes(node.op);
  const leaf = (patch: Partial<Extract<CondNode, { kind: "leaf" }>>) =>
    onChange((n) => (n.kind === "leaf" ? { ...n, ...patch } : n));
  const hint = VALUE_HINT[node.op];
  return (
    <div className="ws-form">
      {/* Library gap (new): Combobox with free text, so an attribute not yet used can be typed. */}
      <TextField
        label={t("inspector.attribute")}
        description={t("inspector.attributeHint")}
        value={node.attr}
        onChange={(e) => leaf({ attr: e.target.value })}
        placeholder="subject.department"
        list={listId}
        readOnly={readOnly}
        spellCheck={false}
        className="ws-mono"
      />
      <datalist id={listId}>
        {attributes.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>
      <Field label={t("inspector.operator")}>
        <Select<Operator>
          items={OPERATORS.map((op) => ({ value: op, label: i18n.t(OPERATOR_LABELS[op]) }))}
          value={node.op}
          disabled={readOnly}
          onValueChange={(op) => {
            if (!op) return;
            // An operator that can't compare attributes goes back to comparing a value.
            leaf({ op, ref: node.ref && REFERENCE_OPERATORS.includes(op) ? true : undefined });
          }}
        />
      </Field>
      {nullary ? null : (
        <>
          <Field label={t("inspector.compareWith")}>
            <ToggleGroup
              value={[node.ref ? "attribute" : "value"]}
              disabled={readOnly || !referable}
              onValueChange={(v) => {
                if (v[0]) leaf({ ref: v[0] === "attribute" ? true : undefined });
              }}
              aria-label={t("inspector.compareWith")}
            >
              <Toggle value="value">{t("inspector.aValue")}</Toggle>
              <Toggle value="attribute">{t("inspector.anotherAttribute")}</Toggle>
            </ToggleGroup>
          </Field>
          <TextField
            label={node.ref ? t("inspector.otherAttribute") : t("inspector.value")}
            description={
              node.ref
                ? t("inspector.attributeHint")
                : hint === "list"
                  ? t("inspector.valueListHint")
                  : hint === "pattern"
                    ? t("inspector.valuePatternHint")
                    : hint === "affix"
                      ? t("inspector.valueAffixHint")
                      : t("inspector.valueHint")
            }
            value={node.value}
            onChange={(e) => leaf({ value: e.target.value })}
            list={node.ref ? listId : undefined}
            readOnly={readOnly}
            spellCheck={false}
          />
        </>
      )}
    </div>
  );
}

/** The policy's own fields, always under the part being edited. */
export function PolicyFields({
  draft,
  onChange,
  readOnly,
  errors,
  labelled,
}: {
  draft: Draft;
  onChange: Change;
  readOnly: boolean;
  errors: FieldErrors;
  /** Under a part being edited, the fields carry their own label; alone, the pane's names them. */
  labelled: boolean;
}) {
  const { t } = useTranslation("authorization");
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const fields = (
    <div className="ws-form">
      <TextField
        label={t("inspector.name")}
        value={draft.name}
        onChange={(e) => set({ name: e.target.value })}
        placeholder={t("inspector.namePlaceholder")}
        error={errors.name}
        invalid={!!errors.name}
        readOnly={readOnly}
      />
      <Field label={t("inspector.description")} optional>
        <Textarea
          value={draft.description}
          onChange={(e) => set({ description: e.target.value })}
          rows={2}
          readOnly={readOnly}
        />
      </Field>
      <Field
        label={t("inspector.effect")}
        description={draft.effect === "allow" ? t("inspector.effectAllowHint") : undefined}
      >
        <ToggleGroup
          value={[draft.effect]}
          disabled={readOnly}
          onValueChange={(v) => {
            const effect = v[0] as Effect | undefined;
            if (effect) set({ effect });
          }}
          aria-label={t("inspector.effect")}
        >
          <Toggle value="allow">{t("rule.allow")}</Toggle>
          <Toggle value="deny">{t("rule.deny")}</Toggle>
        </ToggleGroup>
      </Field>
      <div className="ws-form-pair">
        <TextField
          label={t("inspector.resourceType")}
          description={t("inspector.starForAny")}
          value={draft.resourceType}
          onChange={(e) => set({ resourceType: e.target.value })}
          error={errors.resourceType}
          invalid={!!errors.resourceType}
          readOnly={readOnly}
          spellCheck={false}
        />
        <TextField
          label={t("inspector.action")}
          description={t("inspector.starForAny")}
          value={draft.action}
          onChange={(e) => set({ action: e.target.value })}
          error={errors.action}
          invalid={!!errors.action}
          readOnly={readOnly}
          spellCheck={false}
        />
      </div>
      <Field label={t("inspector.priority")} description={t("inspector.priorityHint")}>
        <NumberField
          value={draft.priority}
          onValueChange={(v) => set({ priority: Math.trunc(v ?? 0) })}
          step={10}
          readOnly={readOnly}
        />
      </Field>
      <Switch
        label={t("inspector.enabled")}
        description={draft.enabled ? undefined : t("inspector.disabledHint")}
        checked={draft.enabled}
        onCheckedChange={(enabled) => set({ enabled })}
        disabled={readOnly}
      />
    </div>
  );
  return labelled ? (
    <Section label={t("inspector.policy")} className="ws-ruled">
      {fields}
    </Section>
  ) : (
    fields
  );
}
