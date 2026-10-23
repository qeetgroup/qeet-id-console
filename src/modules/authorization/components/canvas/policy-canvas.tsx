import "@xyflow/react/dist/style.css";

import { Badge, Button, Skeleton } from "@qeetrix/ui";
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  Handle,
  type Node,
  type NodeProps,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import {
  KeyRoundIcon,
  NetworkIcon,
  PlusIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
} from "@qeetrix/icons";
import type { TFunction } from "i18next";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { countLeaves } from "../../api/abac";
import type { PolicyDoc } from "../../utils/policy-codegen";
import { ClientOnly } from "../shared/client-only";

export type BlockKind = "rbac" | "abac" | "rebac" | "decision";

type Block = Exclude<BlockKind, "decision">;

const BLOCKS: Block[] = ["rbac", "abac", "rebac"];

// Each block's colours; its title is `rbac:policyCanvas.blocks.<kind>`.
const BLOCK_COLORS: Record<Block, string> = {
  rbac: "border-blue-400 bg-blue-50 dark:border-blue-500/60 dark:bg-blue-950/40",
  abac: "border-emerald-400 bg-emerald-50 dark:border-emerald-500/60 dark:bg-emerald-950/40",
  rebac: "border-purple-400 bg-purple-50 dark:border-purple-500/60 dark:bg-purple-950/40",
};

// Whether the doc has this block; the palette offers only the missing ones.
function isActive(doc: PolicyDoc, kind: Block): boolean {
  if (kind === "rbac") return doc.requireRole != null;
  if (kind === "abac") return doc.condition != null;
  return doc.relation != null;
}

function BlockNode({ data }: NodeProps) {
  const { t } = useTranslation("rbac");
  const d = data as { kind: Block; summary: string; selected?: boolean };
  const Icon =
    d.kind === "rbac" ? ShieldCheckIcon : d.kind === "abac" ? SlidersHorizontalIcon : NetworkIcon;
  return (
    <div
      className={`w-52 rounded-lg border-2 px-3 py-2 shadow-sm ${BLOCK_COLORS[d.kind]} ${d.selected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="size-3.5" aria-hidden />
        <p className="text-[11px] font-medium">{t(`policyCanvas.blocks.${d.kind}`)}</p>
      </div>
      <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{d.summary}</p>
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground" />
    </div>
  );
}

function DecisionNode({ data }: NodeProps) {
  const { t } = useTranslation("rbac");
  const d = data as { effect: PolicyDoc["effect"]; target: string; selected?: boolean };
  const allow = d.effect === "allow";
  return (
    <div
      className={`w-52 rounded-lg border-2 px-3 py-2 shadow-md ${allow ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" : "border-rose-500 bg-rose-50 dark:bg-rose-950/40"} ${d.selected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground" />
      <div className="flex items-center gap-2">
        <Badge variant={allow ? "success" : "destructive"}>{t(`decisionBadge.${d.effect}`)}</Badge>
        <KeyRoundIcon className="size-3.5 text-muted-foreground" aria-hidden />
      </div>
      <p className="mt-1 truncate font-mono text-[11px]">{d.target}</p>
    </div>
  );
}

const nodeTypes = { block: BlockNode, decision: DecisionNode };

// Builds the canvas at render, so the block summaries are in the reader's language.
function buildGraph(
  doc: PolicyDoc,
  selected: BlockKind | null,
  t: TFunction,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const active: { kind: Block; y: number; summary: string }[] = [];
  if (doc.requireRole != null)
    active.push({
      kind: "rbac",
      y: 10,
      summary: doc.requireRole || t("rbac:policyCanvas.rolePlaceholder"),
    });
  if (doc.condition != null)
    active.push({
      kind: "abac",
      y: 130,
      summary: t("rbac:policyCanvas.conditionCount", { count: countLeaves(doc.condition) }),
    });
  if (doc.relation != null)
    active.push({
      kind: "rebac",
      y: 250,
      summary: t("rbac:evalTree.relationOf", {
        relation: doc.relation.relation || t("rbac:policyCanvas.relationPlaceholder"),
        object: doc.relation.object || t("rbac:policyCanvas.objectPlaceholder"),
      }),
    });

  for (const b of active) {
    nodes.push({
      id: `block:${b.kind}`,
      type: "block",
      position: { x: 20, y: b.y },
      data: { kind: b.kind, summary: b.summary, selected: selected === b.kind },
    });
    edges.push({
      id: `e-${b.kind}`,
      source: `block:${b.kind}`,
      target: "decision",
      type: "smoothstep",
      animated: true,
    });
  }

  nodes.push({
    id: "decision",
    type: "decision",
    position: { x: 380, y: 130 },
    data: {
      effect: doc.effect,
      target: `${doc.resourceType || "*"}:${doc.action || "*"}`,
      selected: selected === "decision",
    },
  });

  return { nodes, edges };
}

function Canvas({
  doc,
  selected,
  onSelect,
  onToggleBlock,
}: {
  doc: PolicyDoc;
  selected: BlockKind | null;
  onSelect: (kind: BlockKind | null) => void;
  onToggleBlock: (kind: Block) => void;
}) {
  const { t } = useTranslation("rbac");
  // Memoised: the effects below reseed the flow state, and a fresh graph each render would loop.
  const built = useMemo(() => buildGraph(doc, selected, t), [doc, selected, t]);
  const [nodes, setNodes, onNodesChange] = useNodesState(built.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(built.edges);
  useEffect(() => setNodes(built.nodes), [built.nodes, setNodes]);
  useEffect(() => setEdges(built.edges), [built.edges, setEdges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.25 }}
      nodesConnectable={false}
      minZoom={0.4}
      maxZoom={1.8}
      aria-label={t("policyCanvas.unifiedPolicyBuilderCanvas")}
      onNodeClick={(_, node) =>
        onSelect(
          node.id === "decision" ? "decision" : (node.id.slice("block:".length) as BlockKind),
        )
      }
      onPaneClick={() => onSelect(null)}
    >
      <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
      <Controls showInteractive={false} />
      <Panel position="top-left" className="flex flex-wrap gap-1.5">
        {BLOCKS.filter((kind) => !isActive(doc, kind)).map((kind) => (
          <Button key={kind} variant="outline" size="xs" onClick={() => onToggleBlock(kind)}>
            <PlusIcon /> {t(`policyCanvas.add.${kind}`)}
          </Button>
        ))}
      </Panel>
    </ReactFlow>
  );
}

export function PolicyCanvas({
  doc,
  selected,
  onSelect,
  onToggleBlock,
  height = 420,
}: {
  doc: PolicyDoc;
  selected: BlockKind | null;
  onSelect: (kind: BlockKind | null) => void;
  onToggleBlock: (kind: Block) => void;
  height?: number;
}) {
  return (
    <div className="overflow-hidden rounded-md border bg-muted/20" style={{ height }}>
      <ClientOnly fallback={<Skeleton className="size-full" />}>
        <ReactFlowProvider>
          <Canvas doc={doc} selected={selected} onSelect={onSelect} onToggleBlock={onToggleBlock} />
        </ReactFlowProvider>
      </ClientOnly>
    </div>
  );
}
