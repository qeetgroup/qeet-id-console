import { useTranslation } from "react-i18next";

import { Sparkline } from "@/modules/dashboard";
import type { User } from "@/modules/users";
import {
  countBy,
  createdByMonth,
  isLive,
  looksOf,
  type Machine,
  type MachineFilters,
  type MachineKind,
  type MachineLook,
  REACH,
  reachOf,
  TTL_STEPS,
  ttlStep,
  USED,
  usedOf,
} from "@/modules/developer/machine-model";
import {
  BandCount,
  BandLooks,
  BandSplit,
  type Look,
  personName,
  type SplitPart,
  useNumbers,
} from "../parts";
import { type MachineTab, TAB_URL } from "./machine-tabs";

const MONTHS = 15;
const KIND_COLOR: Record<MachineKind, string> = {
  key: "var(--qx-color-dataviz-categorical-1)",
  identity: "var(--qx-color-dataviz-categorical-2)",
  agent: "var(--qx-color-dataviz-categorical-3)",
};
// Ordinal: reading only, changing data, nothing at all (no scopes).
const REACH_COLOR = {
  read: "var(--qx-color-dataviz-sequential-4)",
  write: "var(--qx-color-dataviz-sequential-7)",
  none: "var(--ppl-never)",
} as const;
const USED_COLOR = {
  today: "var(--ppl-today)",
  week: "var(--ppl-week)",
  month: "var(--ppl-month)",
  older: "var(--ppl-older)",
  never: "var(--ppl-never)",
} as const;
const TTL_COLOR = {
  short: "var(--qx-color-dataviz-sequential-4)",
  medium: "var(--qx-color-dataviz-sequential-5)",
  long: "var(--qx-color-dataviz-sequential-7)",
} as const;
const SERIES = [1, 2, 3, 4] as const;
// The looks each tab can have; the All tab has them all.
const TAB_LOOKS: Record<MachineTab, readonly MachineLook[]> = {
  all: ["expired", "expiring", "unused", "noScopes", "suspended", "sponsorGone"],
  key: ["expired", "expiring", "unused", "noScopes"],
  identity: ["noScopes"],
  agent: ["suspended", "sponsorGone", "noScopes"],
};
const DANGER: ReadonlySet<MachineLook> = new Set(["expired", "sponsorGone"]);

/**
 * The tab's key numbers, in the header above the table, on the Users band's parts. Every count opens
 * the list filtered to it. `rows` are the tab's (all three kinds on All); `gone` are the sponsors who
 * can no longer answer for an agent; `unmanaged` counts OAuth clients with a token-exchange grant
 * nobody registered (Agents only).
 */
export function MachineBand({
  tab,
  rows,
  now,
  gone,
  people,
  unmanaged,
}: {
  tab: MachineTab;
  rows: readonly Machine[];
  now: number;
  gone: ReadonlySet<string>;
  people: ReadonlyMap<string, User>;
  unmanaged?: number;
}) {
  const { t } = useTranslation("developer");
  const { n } = useNumbers();
  const to = (search: MachineFilters) => ({ to: TAB_URL[tab], search });
  const live = rows.filter(isLive);
  const months = createdByMonth(
    rows.map((m) => m.createdAt),
    now,
    MONTHS,
  );

  const working = (
    <BandCount
      label={t(`machine.band.working.${tab}`)}
      value={n(live.length)}
      note={t("machine.band.workingNote", {
        off: n(rows.length - live.length),
        total: n(rows.length),
      })}
      chart={
        <>
          <span
            role="img"
            aria-label={t("machine.band.growthLabel", {
              n: n(months.reduce((a, b) => a + b, 0)),
              months: MONTHS,
            })}
          >
            <Sparkline values={months} width={132} height={40} />
          </span>
          <span className="ppl-chart-caption" aria-hidden="true">
            {t("machine.band.months", { months: MONTHS })}
          </span>
        </>
      }
    />
  );

  const reach = (
    <BandSplit
      label={t("machine.band.reach")}
      parts={countBy(live, REACH, (m) => reachOf(m.scopes)).map(
        (p): SplitPart => ({
          ...p,
          label: t(`machine.reach.${p.id}`),
          color: REACH_COLOR[p.id],
          link: to({ reach: p.id }),
        }),
      )}
    />
  );

  const lookCounts = new Map<MachineLook, number>();
  for (const m of rows)
    for (const look of looksOf(m, now, gone)) lookCounts.set(look, (lookCounts.get(look) ?? 0) + 1);
  const looks: Look[] = TAB_LOOKS[tab].map((id) => ({
    id,
    label: t(`machine.looks.${id}`),
    count: lookCounts.get(id) ?? 0,
    danger: DANGER.has(id),
    link: to({ look: id }),
  }));
  if (tab === "agent" && unmanaged !== undefined)
    looks.push({
      id: "unmanaged",
      label: t("machine.looks.unmanaged"),
      count: unmanaged,
      href: "#unmanaged-clients",
    });
  const needs = <BandLooks label={t("machine.band.needsALook")} looks={looks} />;

  if (tab === "all")
    return (
      <dl className="ppl-band">
        {working}
        <BandSplit
          label={t("machine.band.kinds")}
          parts={countBy(live, ["key", "identity", "agent"] as const, (m) => m.kind).map((p) => ({
            ...p,
            label: t(`machine.kindPlural.${p.id}`),
            color: KIND_COLOR[p.id],
            link: { to: TAB_URL[p.id] },
          }))}
        />
        {reach}
        {needs}
      </dl>
    );

  if (tab === "key") {
    const expiry = [
      { id: "expired", count: rows.filter((m) => m.status === "expired").length },
      { id: "expiring", count: rows.filter((m) => m.status === "expiring").length },
      { id: "later", count: live.filter((m) => m.expiresAt && m.status === "active").length },
      { id: "never", count: live.filter((m) => !m.expiresAt).length },
    ] as const;
    const EXPIRY_COLOR = {
      expired: "var(--qx-color-dataviz-negative)",
      expiring: "var(--qx-color-dataviz-warning)",
      later: "var(--qx-color-dataviz-sequential-5)",
      never: "var(--ppl-never)",
    } as const;
    return (
      <dl className="ppl-band">
        {working}
        <BandSplit
          label={t("machine.band.used")}
          parts={countBy(live, USED, (m) => usedOf(m.lastUsedAt, now)).map((p) => ({
            ...p,
            label: t(`machine.used.${p.id}`),
            color: USED_COLOR[p.id],
            link: to({ used: p.id }),
          }))}
        />
        <BandSplit
          label={t("machine.band.expiry")}
          parts={expiry.map((p) => ({
            ...p,
            label: t(`machine.expiry.${p.id}`),
            color: EXPIRY_COLOR[p.id],
            link: p.id === "expired" || p.id === "expiring" ? to({ status: p.id }) : undefined,
          }))}
        />
        {needs}
      </dl>
    );
  }

  if (tab === "identity") {
    // The scopes most identities hold: who can write to people, say, is one click away.
    const counts = new Map<string, number>();
    for (const m of live) for (const s of m.scopes) counts.set(s, (counts.get(s) ?? 0) + 1);
    const top = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4);
    return (
      <dl className="ppl-band">
        {working}
        {reach}
        <BandSplit
          label={t("machine.band.topScopes")}
          parts={top.map(([scope, count], i) => ({
            id: scope,
            count,
            label: scope,
            color: `var(--qx-color-dataviz-categorical-${SERIES[i] ?? 4})`,
            link: to({ q: scope }),
          }))}
        />
        {needs}
      </dl>
    );
  }

  // Agents: who answers for them, and how long their tokens last.
  const sponsors = new Map<string, number>();
  for (const m of rows)
    if (m.personId) sponsors.set(m.personId, (sponsors.get(m.personId) ?? 0) + 1);
  const ranked = [...sponsors].sort((a, b) => b[1] - a[1]);
  const shown = ranked.slice(0, 3);
  const others = ranked.slice(3).reduce((sum, [, c]) => sum + c, 0);
  return (
    <dl className="ppl-band">
      {working}
      <BandSplit
        label={t("machine.band.sponsors")}
        parts={[
          ...shown.map(([id, count], i) => ({
            id,
            count,
            label: personName(people.get(id)) ?? t("owner.unknown"),
            color: `var(--qx-color-dataviz-categorical-${SERIES[i] ?? 4})`,
            link: to({ sponsor: id }),
          })),
          ...(others
            ? [
                {
                  id: "others",
                  count: others,
                  label: t("machine.band.otherSponsors"),
                  color: "var(--ppl-never)",
                },
              ]
            : []),
        ]}
      />
      <BandSplit
        label={t("machine.band.ttl")}
        parts={countBy(live, TTL_STEPS, (m) => (m.ttl ? ttlStep(m.ttl) : undefined)).map((p) => ({
          ...p,
          label: t(`machine.ttl.${p.id}`),
          color: TTL_COLOR[p.id],
        }))}
      />
      {needs}
    </dl>
  );
}
