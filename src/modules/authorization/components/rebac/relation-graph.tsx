import { BoxIcon, FileTextIcon, FolderIcon, UserRoundIcon, UsersIcon } from "@qeetrix/icons";
import { GraphCanvas, type GraphNode } from "@qeetrix/react/experimental";
import { useTranslation } from "react-i18next";

import { usePeople } from "@/modules/authorization/components/shared/use-people";
import type { DrawnNode, GraphModel } from "./graph-model";

const ICON = { document: FileTextIcon, folder: FolderIcon, group: UsersIcon, team: UsersIcon };

/**
 * Who reaches an object, top down, on Qeetrix's GraphCanvas: each node under the one it was reached
 * through, with the relation on its line. Zoom and fit; the nodes are one Tab stop, the arrow keys
 * move along the tree, and each says what it's reached from.
 */
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

  // Each node under the one it's drawn beneath, with the relation it was reached by.
  const parentOf = new Map<string, string>();
  for (const n of model.nodes.values()) for (const child of n.children) parentOf.set(child, n.id);
  const nodes: GraphNode[] = [...model.nodes.values()].map((n) => {
    const parent =
      parentOf.get(n.id) ?? (n.kind === "people" ? n.id.slice("people:".length) : undefined);
    return {
      id: n.id,
      label: title(n),
      meta: meta(n),
      icon:
        n.kind === "object"
          ? (ICON[n.type as keyof typeof ICON] ?? BoxIcon)
          : n.kind === "user"
            ? UserRoundIcon
            : UsersIcon,
      parent: n.id === model.root ? undefined : parent,
      relation: parent
        ? model.edges.find((e) => e.from === parent && e.to === n.id)?.relation
        : undefined,
    };
  });

  return (
    <GraphCanvas
      className="rb-graph"
      nodes={nodes}
      aria-label={label}
      selected={selected}
      onSelect={onSelect}
      messages={{ zoomIn: t("graph.zoomIn"), zoomOut: t("graph.zoomOut"), fit: t("graph.fit") }}
    />
  );
}
