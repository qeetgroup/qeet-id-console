import { formatNumber } from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { GroupNode } from "@/modules/groups/groups-model";

// The picture's own units; it draws at the page's width.
const W = 1000;
const ROW = 30;
const X = { parent: 190, level: 470, inside: 760 };
const radius = (people: number) => (people ? 4 + Math.sqrt(people) * 2.2 : 5);
const curve = (x1: number, y1: number, x2: number, y2: number) =>
  `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;

/**
 * Where a group sits: the group it's in, the groups beside it (this one marked, in graphite) and the
 * groups inside it, each sized by the people it covers and opening its own page. One data hue for
 * the rest, and a warning ring for a group no one is in. Each node is a link named by its group and
 * its people.
 */
export function GroupFamily({ group, parent }: { group: GroupNode; parent?: GroupNode }) {
  const { t } = useTranslation("groups");
  const n = (value: number) => formatNumber(value, formatLocale());
  const level = parent ? parent.children : [group];
  const inside = group.children;
  const rows = Math.max(level.length, inside.length, 1);
  const h = rows * ROW + 16;
  const y = (i: number, of: number) => 8 + (rows * ROW) / 2 + (i - (of - 1) / 2) * ROW;
  const gy = y(
    Math.max(
      0,
      level.findIndex((g) => g.id === group.id),
    ),
    level.length,
  );
  const node = (g: GroupNode, x: number, cy: number, side: "start" | "end") => {
    const me = g.id === group.id;
    const r = radius(g.people);
    return (
      <Link
        key={g.id}
        to="/groups/$groupId"
        params={{ groupId: g.id }}
        className="grp-fam-node"
        // The name starts with what the node shows ("Payments 5", "People empty"), so it holds
        // its visible text (WCAG 2.5.3).
        aria-label={
          g.people
            ? t(
                me
                  ? "page.family.this"
                  : g.id === parent?.id
                    ? "page.family.parent"
                    : "page.family.other",
                {
                  name: g.name,
                  count: g.people,
                  n: n(g.people),
                },
              )
            : t(
                me
                  ? "page.family.emptyThis"
                  : g.id === parent?.id
                    ? "page.family.emptyParent"
                    : "page.family.emptyOther",
                {
                  name: g.name,
                },
              )
        }
      >
        <circle
          cx={x}
          cy={cy}
          r={r}
          className={
            g.people ? (me ? "grp-fam-dot is-current" : "grp-fam-dot") : "grp-fam-dot is-empty"
          }
        />
        <text
          x={side === "end" ? x + r + 8 : x - r - 8}
          y={cy + 4}
          textAnchor={side === "end" ? "start" : "end"}
          className={
            me ? "grp-fam-label is-current" : g.people ? "grp-fam-label" : "grp-fam-label is-empty"
          }
        >
          {g.name}{" "}
          <tspan className="grp-fam-n">{g.people ? n(g.people) : t("page.family.empty")}</tspan>
        </text>
      </Link>
    );
  };

  return (
    <svg className="grp-fam" viewBox={`0 0 ${W} ${h}`}>
      <title>{t("page.family.label", { name: group.name })}</title>
      {parent
        ? level.map((g, i) => (
            <path
              key={g.id}
              d={curve(X.parent, y(0, 1), X.level, y(i, level.length))}
              className="grp-fam-link"
            />
          ))
        : null}
      {inside.map((g, i) => (
        <path
          key={g.id}
          d={curve(X.level, gy, X.inside, y(i, inside.length))}
          className="grp-fam-link"
        />
      ))}
      {parent ? node(parent, X.parent, y(0, 1), "start") : null}
      {level.map((g, i) =>
        node(g, X.level, y(i, level.length), g.id === group.id && inside.length ? "start" : "end"),
      )}
      {inside.map((g, i) => node(g, X.inside, y(i, inside.length), "end"))}
      {inside.length ? null : (
        <text x={X.inside} y={gy + 4} className="grp-fam-none">
          {t("page.family.noneInside")}
        </text>
      )}
    </svg>
  );
}
