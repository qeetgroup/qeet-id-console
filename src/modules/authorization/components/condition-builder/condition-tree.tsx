import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Combobox, Input } from "@qeetrix/ui";
import { FolderPlusIcon, PlusIcon, TrashIcon } from "@qeetrix/icons";

import {
  type CondNode,
  emptyGroup,
  emptyLeaf,
  LIST_OPERATORS,
  NAMESPACES,
  type Namespace,
  NULLARY_OPERATORS,
  nid,
  OPERATOR_LABELS,
  OPERATORS,
  type Operator,
  REFERENCE_OPERATORS,
} from "../../api/abac";

// Namespaces are attribute-path syntax (`subject.dept`), so they show as written.
const NS_ITEMS = NAMESPACES.map((n) => ({ label: n, value: n }));
const OPERANDS = ["value", "attribute"] as const;

/**
 * Renders a no-code editor for an ABAC condition: nested ALL/ANY groups, NOT wrappers and
 * comparison leaves. Emits the editable CondNode form; serialize it with toConditionJson.
 */
export function ConditionTree({
  value,
  onChange,
}: {
  value: CondNode;
  onChange: (node: CondNode) => void;
}) {
  return <NodeEditor node={value} onChange={onChange} depth={0} />;
}

function NodeEditor({
  node,
  onChange,
  onRemove,
  depth,
}: {
  node: CondNode;
  onChange: (node: CondNode) => void;
  onRemove?: () => void;
  depth: number;
}) {
  const { t } = useTranslation("rbac");
  if (node.kind === "leaf")
    return <LeafEditor node={node} onChange={onChange} onRemove={onRemove} />;
  if (node.kind === "not") {
    return (
      <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
        <div className="mb-2 flex items-center justify-between">
          <Badge variant="destructive">{t("conditionTree.not")}</Badge>
          {onRemove && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onRemove}
              aria-label={t("conditionTree.removeNot")}
            >
              <TrashIcon />
            </Button>
          )}
        </div>
        <NodeEditor
          node={node.child}
          onChange={(child) => onChange({ ...node, child })}
          depth={depth + 1}
        />
      </div>
    );
  }

  const combinatorColor =
    node.combinator === "all"
      ? "border-blue-500/30 bg-blue-500/5"
      : "border-amber-500/30 bg-amber-500/5";

  // `node` is narrowed to a group here; capturing it keeps that type inside the closures below.
  const group = node;
  const updateChild = (index: number, child: CondNode) => {
    onChange({ ...group, children: group.children.map((c, i) => (i === index ? child : c)) });
  };
  const removeChild = (index: number) => {
    const next = group.children.filter((_, i) => i !== index);
    onChange({ ...group, children: next.length ? next : [emptyLeaf()] });
  };

  return (
    <div className={`rounded-lg border p-3 ${combinatorColor}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-md border bg-background p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => onChange({ ...node, combinator: "all" })}
            className={`rounded px-2 py-0.5 ${node.combinator === "all" ? "bg-blue-500/20 text-blue-700 dark:text-blue-300" : "text-muted-foreground"}`}
          >
            {t("conditionTree.all")}
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...node, combinator: "any" })}
            className={`rounded px-2 py-0.5 ${node.combinator === "any" ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}
          >
            {t("conditionTree.any")}
          </button>
        </div>
        {onRemove && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onRemove}
            aria-label={t("conditionTree.removeGroup")}
          >
            <TrashIcon />
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {node.children.map((child, i) => (
          <NodeEditor
            key={child.id}
            node={child}
            onChange={(c) => updateChild(i, c)}
            onRemove={() => removeChild(i)}
            depth={depth + 1}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="xs"
          onClick={() => onChange({ ...node, children: [...node.children, emptyLeaf()] })}
        >
          <PlusIcon /> {t("conditionTree.addCondition")}
        </Button>
        <Button
          variant="outline"
          size="xs"
          onClick={() => onChange({ ...node, children: [...node.children, emptyGroup("all")] })}
        >
          <FolderPlusIcon /> {t("conditionTree.addGroup")}
        </Button>
        <Button
          variant="outline"
          size="xs"
          onClick={() =>
            onChange({
              ...node,
              children: [...node.children, { id: nid("not"), kind: "not", child: emptyLeaf() }],
            })
          }
        >
          <PlusIcon /> {t("conditionTree.not")}
        </Button>
      </div>
    </div>
  );
}

function LeafEditor({
  node,
  onChange,
  onRemove,
}: {
  node: Extract<CondNode, { kind: "leaf" }>;
  onChange: (node: CondNode) => void;
  onRemove?: () => void;
}) {
  const { t } = useTranslation("rbac");
  const dot = node.attr.indexOf(".");
  const ns: Namespace = (dot >= 0 ? node.attr.slice(0, dot) : "subject") as Namespace;
  const field = dot >= 0 ? node.attr.slice(dot + 1) : node.attr;
  const isNullary = NULLARY_OPERATORS.includes(node.op);
  const isList = LIST_OPERATORS.includes(node.op);
  const canReference = REFERENCE_OPERATORS.includes(node.op);
  const opItems = useMemo(
    () => OPERATORS.map((o) => ({ label: t(OPERATOR_LABELS[o]), value: o })),
    [t],
  );
  const operandItems = useMemo(
    () => OPERANDS.map((o) => ({ label: t(`conditionTree.operand.${o}`), value: o })),
    [t],
  );

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2">
      <div className="w-28 shrink-0">
        <Combobox
          items={NS_ITEMS}
          value={ns}
          onValueChange={(v) => onChange({ ...node, attr: `${v ?? "subject"}.${field}` })}
          aria-label={t("conditionTree.namespace")}
        />
      </div>
      <Input
        className="w-40 font-mono text-xs"
        placeholder={t("conditionTree.attributePlaceholder")}
        value={field}
        aria-label={t("conditionTree.attributePath")}
        onChange={(e) => onChange({ ...node, attr: `${ns}.${e.target.value}` })}
      />
      <div className="w-40 shrink-0">
        <Combobox
          items={opItems}
          value={node.op}
          onValueChange={(v) => {
            const op = (v ?? "eq") as Operator;
            onChange({ ...node, op, ref: REFERENCE_OPERATORS.includes(op) && node.ref });
          }}
          aria-label={t("conditionTree.operator")}
        />
      </div>
      {canReference && (
        <div className="w-28 shrink-0">
          <Combobox
            items={operandItems}
            value={node.ref ? "attribute" : "value"}
            onValueChange={(v) => onChange({ ...node, ref: v === "attribute" })}
            aria-label={t("conditionTree.compareWith")}
          />
        </div>
      )}
      {!isNullary && (
        <Input
          className="w-44 font-mono text-xs"
          placeholder={
            node.ref
              ? "resource.owner_id"
              : isList
                ? "a, b, c"
                : t("conditionTree.valuePlaceholder")
          }
          value={node.value}
          aria-label={node.ref ? t("conditionTree.otherAttribute") : t("conditionTree.value")}
          onChange={(e) => onChange({ ...node, value: e.target.value })}
        />
      )}
      {onRemove && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto"
          onClick={onRemove}
          aria-label={t("conditionTree.removeCondition")}
        >
          <TrashIcon />
        </Button>
      )}
    </div>
  );
}
