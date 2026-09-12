import { cn } from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, UsersRoundIcon } from "lucide-react";

import type { Group } from "../api/groups";

type Node = Group & { children: Node[] };

/**
 * Builds the parent/child forest from the flat list.
 *
 * A group whose parent_id points at something not in the list (filtered out, or
 * deleted concurrently) is promoted to a root rather than dropped — silently
 * hiding rows would make the tree disagree with the count above it.
 */
function toForest(groups: Group[]): Node[] {
  const byId = new Map<string, Node>(groups.map((g) => [g.id, { ...g, children: [] }]));
  const roots: Node[] = [];
  for (const node of byId.values()) {
    const parent = node.parent_id ? byId.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (nodes: Node[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

export function GroupHierarchy({ groups }: { groups: Group[] }) {
  const roots = toForest(groups);
  return (
    <ul className="flex flex-col py-2">
      {roots.map((n) => (
        <TreeNode key={n.id} node={n} depth={0} />
      ))}
    </ul>
  );
}

function TreeNode({ node, depth }: { node: Node; depth: number }) {
  return (
    <li>
      <Link
        to="/groups/$groupId"
        params={{ groupId: node.id }}
        className="group flex items-center gap-3 px-4 py-2.5 outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/50"
        style={{ paddingInlineStart: `${depth * 1.5 + 1}rem` }}
      >
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-md",
            depth === 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          <UsersRoundIcon className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{node.name}</span>
          {node.description ? (
            <span className="block truncate text-xs text-muted-foreground">{node.description}</span>
          ) : null}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {node.member_count}
        </span>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
      {node.children.length > 0 ? (
        <ul className="flex flex-col">
          {node.children.map((c) => (
            <TreeNode key={c.id} node={c} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
