import { formatNumber, Meter } from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { Sparkline, SplitBar } from "@/modules/dashboard";
import {
  type GroupNode,
  grantsToNoOne,
  type GroupFilters,
  type RolesByGroup,
  SIZES,
  sizeOf,
} from "@/modules/groups/groups-model";
import { growth, type User } from "@/modules/users";

const GROWTH_MONTHS = 15;
type Look = {
  id: "empty" | "unused-roles" | "no-group";
  count: number;
  link: { to: "/groups"; search: GroupFilters } | { to: "/users"; search: { group: "none" } };
  danger?: boolean;
};
// The Users band's ordinal ramp (people.css), bigger groups darker; empty is its "never" step.
const SWATCH = {
  empty: "never",
  one: "older",
  few: "month",
  team: "week",
  large: "today",
} as const;

/**
 * The list's key numbers, in its header above the table, on the Users band's parts: groups over
 * time, how many people are in one, group sizes, and what needs a look. Each opens the list (or
 * Users) filtered to it. `roles` is complete or undefined: until every group's roles are in, the
 * look that needs them waits.
 */
export function GroupsBand({
  all,
  people,
  roles,
  now,
}: {
  all: GroupNode[];
  people?: User[];
  roles?: RolesByGroup;
  now: number;
}) {
  const { t } = useTranslation("groups");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const to = (search: GroupFilters) => ({ to: "/groups" as const, search });

  const top = all.filter((g) => g.depth === 0).length;
  const levels = Math.max(0, ...all.map((g) => g.depth)) + 1;
  const months = growth(all, now, GROWTH_MONTHS);
  const sizes = SIZES.map((id) => ({
    id,
    count: all.filter((g) => sizeOf(g.people) === id).length,
  }));
  const inNoGroup = people?.filter((u) => !u.groups_count).length;
  const inAGroup = people ? people.length - (inNoGroup ?? 0) : 0;
  const share = people?.length ? Math.round((inAGroup / people.length) * 100) : 0;
  const looks: Look[] = [
    { id: "empty", count: sizes[0]?.count ?? 0, link: to({ look: "empty" }) },
    ...(roles
      ? [
          {
            id: "unused-roles" as const,
            count: all.filter((g) => grantsToNoOne(g, roles)).length,
            link: to({ look: "unused-roles" }),
            danger: true,
          },
        ]
      : []),
    ...(inNoGroup !== undefined
      ? [
          {
            id: "no-group" as const,
            count: inNoGroup,
            link: { to: "/users" as const, search: { group: "none" as const } },
          },
        ]
      : []),
  ];

  return (
    <dl className={people ? "ppl-band" : "ppl-band is-three"}>
      <div className="ppl-cell">
        <dt className="ppl-label">{t("list.band.groups")}</dt>
        <dd className="ppl-value">{n(all.length)}</dd>
        <dd className="ppl-note">
          {levels > 2
            ? t("list.band.topAndLevels", { top: n(top), levels: n(levels) })
            : t("list.band.topAndInside", { top: n(top), inside: n(all.length - top) })}
        </dd>
        <dd className="ppl-chart">
          <span
            role="img"
            aria-label={t("list.band.growthLabel", {
              from: n(months[0] ?? 0),
              to: n(months[months.length - 1] ?? 0),
              months: GROWTH_MONTHS,
            })}
          >
            <Sparkline values={months} width={132} height={40} />
          </span>
          <span className="ppl-chart-caption" aria-hidden="true">
            {t("list.band.months", { months: GROWTH_MONTHS })}
          </span>
        </dd>
      </div>

      {people ? (
        <div className="ppl-cell">
          <dt className="ppl-label">{t("list.band.inAGroup")}</dt>
          <dd className="ppl-value">{t("list.band.percent", { n: share })}</dd>
          <dd className="ppl-note">
            {t("list.band.inAGroupNote", { n: n(inAGroup), total: n(people.length) })}
          </dd>
          <dd className="ppl-meter">
            <Meter
              value={share}
              tone="success"
              aria-label={t("list.band.inAGroupLabel", { n: share })}
            />
          </dd>
          {inNoGroup ? (
            <dd className="ppl-link">
              <Link to="/users" search={{ group: "none" }}>
                {t("list.band.inNoGroup", { n: n(inNoGroup) })}
              </Link>
            </dd>
          ) : null}
        </div>
      ) : null}

      <div className="ppl-cell">
        <dt className="ppl-label">{t("list.band.size")}</dt>
        <dd className="ppl-recency">
          <SplitBar
            label={sizes.map((s) => `${t(`list.sizes.${s.id}`)}: ${n(s.count)}`).join(", ")}
            parts={sizes.map((s) => ({ value: s.count, color: `var(--ppl-${SWATCH[s.id]})` }))}
          />
        </dd>
        <dd className="ppl-recency-legend">
          <ul>
            {sizes.map((s) => (
              <li key={s.id} className={s.count ? undefined : "is-zero"}>
                <Link {...to({ size: s.id })}>
                  <span className={`ppl-swatch is-${SWATCH[s.id]}`} aria-hidden="true" />
                  <b>{n(s.count)}</b> {t(`list.band.sizeLegend.${s.id}`)}
                </Link>
              </li>
            ))}
          </ul>
        </dd>
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("list.band.needsALook")}</dt>
        <dd className="ppl-looks">
          <ul>
            {looks.map((look) => (
              <li key={look.id} className={look.count ? undefined : "is-zero"}>
                <Link {...look.link}>
                  <span>{t(`list.band.looks.${look.id}`)}</span>
                  <b className={look.count && look.danger ? "is-danger" : undefined}>
                    {n(look.count)}
                  </b>
                </Link>
              </li>
            ))}
          </ul>
        </dd>
      </div>
    </dl>
  );
}
