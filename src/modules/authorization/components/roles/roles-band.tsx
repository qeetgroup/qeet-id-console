import { Meter } from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Sparkline, SplitBar } from "@/modules/dashboard";
import { growth } from "@/modules/users";
import type { RoleAccessView } from "@/modules/authorization/api/role-access";
import {
  permissionsByPerson,
  REACH,
  type Reach,
  reachOf,
} from "@/modules/authorization/role-model";
import { useCount } from "../lists/authz-parts";
import { ROLE_LOOKS, type RoleFilters, roleLook } from "./roles-model";

const GROWTH_MONTHS = 15;
// The Users band's ordinal ramp (people.css): more access, darker; no access is its "never" step.
const SWATCH: Record<Reach, string> = {
  every: "today",
  changes: "week",
  reads: "month",
  none: "never",
};

/**
 * The list's key numbers, in its header: roles over time, how many people hold one, what people
 * can do with what they hold, and the roles that need a look. Each look opens the list filtered to
 * it. People and groups count only when the caller may read them.
 */
export function RolesBand({ view }: { view: RoleAccessView }) {
  const { t } = useTranslation("authorization");
  const n = useCount();
  const { roles, access, people, catalogue, now } = view;
  const builtIn = roles.filter((r) => r.is_system).length;
  const months = growth(roles, now, GROWTH_MONTHS);
  const to = (search: RoleFilters) => ({ to: "/authorization/roles" as const, search });

  const held = permissionsByPerson(access);
  const everyone = people ?? [];
  const withRole = everyone.filter((u) => held.has(u.id));
  const share = everyone.length ? Math.round((withRole.length / everyone.length) * 100) : 0;
  const reach = REACH.map((id) => ({
    id,
    count: everyone.filter((u) => reachOf(held.get(u.id), catalogue.length) === id).length,
  }));
  const looks = ROLE_LOOKS.filter(
    (look) => look !== "unused" || (view.peopleKnown && view.groupsKnown),
  ).map((look) => ({
    look,
    count: access.filter((a) => roleLook(a, look, catalogue.length)).length,
  }));

  const showPeople = view.peopleKnown;
  return (
    <dl className={showPeople ? "ppl-band" : "ppl-band authz-band-two"}>
      <div className="ppl-cell">
        <dt className="ppl-label">{t("lists.roles.band.roles")}</dt>
        <dd className="ppl-value">{n(roles.length)}</dd>
        <dd className="ppl-note">
          {t("lists.roles.band.rolesNote", {
            custom: n(roles.length - builtIn),
            builtIn: n(builtIn),
          })}
        </dd>
        <dd className="ppl-chart">
          <span
            role="img"
            aria-label={t("lists.roles.band.growthLabel", {
              from: n(months[0] ?? 0),
              to: n(months[months.length - 1] ?? 0),
              months: GROWTH_MONTHS,
            })}
          >
            <Sparkline values={months} width={132} height={40} />
          </span>
          <span className="ppl-chart-caption" aria-hidden="true">
            {t("lists.common.months", { months: GROWTH_MONTHS })}
          </span>
        </dd>
      </div>

      {showPeople ? (
        <div className="ppl-cell">
          <dt className="ppl-label">{t("lists.roles.band.withRole")}</dt>
          <dd className="ppl-value">{t("lists.common.percent", { n: share })}</dd>
          <dd className="ppl-note">
            {t("lists.roles.band.withRoleNote", {
              n: n(withRole.length),
              total: n(everyone.length),
            })}
          </dd>
          <dd className="ppl-meter">
            <Meter
              value={share}
              tone="neutral"
              aria-label={t("lists.roles.band.withRoleLabel", { n: share })}
            />
          </dd>
        </div>
      ) : null}

      {showPeople ? (
        <div className="ppl-cell">
          <dt className="ppl-label">{t("lists.roles.band.reach")}</dt>
          <dd className="ppl-recency">
            <SplitBar
              label={reach
                .map((r) => `${n(r.count)} ${t(`lists.roles.band.reachLegend.${r.id}`)}`)
                .join(", ")}
              parts={reach.map((r) => ({ value: r.count, color: `var(--ppl-${SWATCH[r.id]})` }))}
            />
          </dd>
          <dd className="ppl-recency-legend authz-legend" aria-hidden="true">
            <ul>
              {reach.map((r) => (
                <li key={r.id} className={r.count ? undefined : "is-zero"}>
                  <span className={`ppl-swatch is-${SWATCH[r.id]}`} />
                  <b>{n(r.count)}</b> {t(`lists.roles.band.reachLegend.${r.id}`)}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      ) : null}

      <div className="ppl-cell">
        <dt className="ppl-label">{t("lists.common.needsALook")}</dt>
        <dd className="ppl-looks">
          <ul>
            {looks.map(({ look, count }) => (
              <li key={look} className={count ? undefined : "is-zero"}>
                <Link {...to({ look })}>
                  <span>{t(`lists.roles.band.looks.${look}`)}</span>
                  <b className={count && look === "every" ? "is-warning" : undefined}>{n(count)}</b>
                </Link>
              </li>
            ))}
          </ul>
        </dd>
      </div>
    </dl>
  );
}
