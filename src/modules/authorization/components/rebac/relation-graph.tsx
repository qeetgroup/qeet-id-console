// Library gap (new): a graph / node canvas (a layered layout, zoom and fit, keyboard), asked for by
// ReBAC; drawn here as SVG lines and node buttons from tokens.
import {
  BoxIcon,
  FileTextIcon,
  FolderIcon,
  MaximizeIcon,
  UserRoundIcon,
  UsersIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "@qeetrix/icons";
import { IconButton } from "@qeetrix/react";
import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { usePeople } from "@/modules/authorization/components/shared/use-people";
import { type DrawnNode, type GraphModel, NODE_H, NODE_W } from "./graph-model";

const ICON = { document: FileTextIcon, folder: FolderIcon, group: UsersIcon, team: UsersIcon };
const ZOOMS = [0.5, 0.67, 0.8, 1, 1.25, 1.5];

/** Who reaches an object, top down: each node under the one it was reached through. */
export function RelationGraph({
  model,
  selected,
  onSelect,
  label,
}: {
  model: GraphModel;
  selected: string;
  onSelect: (id: string) => void;
  label: string;
}) {
  const { t } = useTranslation("authorization");
  const people = usePeople();
  const frame = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  // Opens at full size, to be read (a wide one scrolls, centred on the object); Fit shows it whole.
  // biome-ignore lint/correctness/useExhaustiveDependencies: opens once per graph
  useLayoutEffect(() => setZoom(1), [model]);
  function fitted() {
    const room = frame.current?.clientWidth ?? 0;
    return room > 0 ? Math.min(1, Math.max(0.5, (room - 16) / model.width)) : 1;
  }
  const fitToView = () => setZoom(fitted());
  // The object sits at the top centre: keep it in view as the graph opens or zooms.
  // biome-ignore lint/correctness/useExhaustiveDependencies: recentres on a new graph or zoom
  useLayoutEffect(() => {
    const el = frame.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [model, zoom]);
  const step = (dir: 1 | -1) => {
    const i = ZOOMS.findIndex((z) => z >= zoom - 0.001);
    const next = ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, (i === -1 ? 3 : i) + dir))];
    if (next) setZoom(next);
  };

  const title = (n: DrawnNode) =>
    n.kind === "people"
      ? t("graph.morePeople", { count: n.people.length })
      : n.kind === "user"
        ? (people.name(n.label) ?? t("graph.person"))
        : n.label;
  const meta = (n: DrawnNode) => {
    if (n.kind === "people") return t("graph.directly");
    if (n.kind === "user") return t("graph.person");
    if (n.people.length) return t("graph.members", { count: n.people.length });
    const groups = n.children.filter((c) => model.nodes.get(c)?.type === "group").length;
    if (groups && groups === n.children.length) return t("graph.groups", { count: groups });
    return n.type;
  };

  // Each parent's children share one elbow: down from the parent, across, down to each child.
  const parents = [...model.nodes.values()].filter((n) => n.children.length);
  return (
    <div className="graph-frame">
      <div className="graph-tools">
        <IconButton
          icon={ZoomInIcon}
          aria-label={t("graph.zoomIn")}
          size="sm"
          variant="ghost"
          tone="neutral"
          onClick={() => step(1)}
        />
        <IconButton
          icon={ZoomOutIcon}
          aria-label={t("graph.zoomOut")}
          size="sm"
          variant="ghost"
          tone="neutral"
          onClick={() => step(-1)}
        />
        <IconButton
          icon={MaximizeIcon}
          aria-label={t("graph.fit")}
          size="sm"
          variant="ghost"
          tone="neutral"
          onClick={fitToView}
        />
      </div>
      <div className="graph-viewport" ref={frame}>
        <div
          className="graph-scroll"
          style={{ blockSize: model.height * zoom + 16, inlineSize: model.width * zoom }}
        >
          <figure
            className="graph"
            aria-label={label}
            style={{
              inlineSize: model.width,
              blockSize: model.height,
              transform: `scale(${zoom})`,
            }}
          >
            <svg
              className="graph-lines"
              viewBox={`0 0 ${model.width} ${model.height}`}
              aria-hidden="true"
            >
              {parents.map((p) => {
                const kids = p.children
                  .map((c) => model.nodes.get(c))
                  .filter((k): k is DrawnNode => !!k);
                const x0 = p.x + NODE_W / 2;
                const yMid = p.y + NODE_H + (kids[0] ? (kids[0].y - p.y - NODE_H) / 2 : 0);
                const xs = kids.map((k) => k.x + NODE_W / 2);
                const relation = model.edges.find((e) => e.from === p.id)?.relation;
                return (
                  <g key={p.id}>
                    <line x1={x0} y1={p.y + NODE_H} x2={x0} y2={yMid} />
                    <line x1={Math.min(x0, ...xs)} y1={yMid} x2={Math.max(x0, ...xs)} y2={yMid} />
                    {kids.map((k) => (
                      <line
                        key={k.id}
                        x1={k.x + NODE_W / 2}
                        y1={yMid}
                        x2={k.x + NODE_W / 2}
                        y2={k.y}
                      />
                    ))}
                    {relation ? (
                      <text className="graph-edge-label" x={x0 + 6} y={p.y + NODE_H + 13}>
                        {relation}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
            {[...model.nodes.values()].map((n) => {
              const Icon =
                n.kind === "object"
                  ? (ICON[n.type as keyof typeof ICON] ?? BoxIcon)
                  : n.kind === "user"
                    ? UserRoundIcon
                    : UsersIcon;
              const current = selected === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  className="graph-node"
                  data-root={n.id === model.root || undefined}
                  data-current={current || undefined}
                  aria-current={current ? "true" : undefined}
                  style={{
                    insetInlineStart: n.x,
                    insetBlockStart: n.y,
                    inlineSize: NODE_W,
                    blockSize: NODE_H,
                  }}
                  onClick={() => onSelect(n.id)}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>
                    <strong>{title(n)}</strong>
                    <small>{meta(n)}</small>
                  </span>
                </button>
              );
            })}
          </figure>
        </div>
      </div>
    </div>
  );
}
