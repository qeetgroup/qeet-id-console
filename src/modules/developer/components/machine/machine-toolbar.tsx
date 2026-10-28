import { Select } from "@qeetrix/react";
import { type AppliedFilter, FilterTags, SearchField } from "@qeetrix/react/experimental";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { User } from "@/modules/users";
import {
  CRED_STATUSES,
  type CredStatus,
  type Machine,
  type MachineFilters,
  type MachineKind,
  REACH,
  type Reach,
  reachOf,
  USED,
  type Used,
  usedOf,
} from "@/modules/developer/machine-model";
import { personName, useNumbers } from "../parts";
import type { MachineTab } from "./machine-tabs";

const ANY = "";
// Each option's count is in its label until Select items have a count of their own (QTRX-20).

/**
 * One row above the table: search, then the filters this tab has (kind and what they can do on
 * All; when last used on API keys; sponsor on Agents), status last. Under it, once something
 * narrows the list, what's applied as tags, with how many that leaves.
 */
export function MachineToolbar({
  tab,
  rows,
  now,
  people,
  filters,
  onFiltersChange,
  shown,
}: {
  tab: MachineTab;
  rows: readonly Machine[];
  now: number;
  people: ReadonlyMap<string, User>;
  filters: MachineFilters;
  onFiltersChange: (next: MachineFilters) => void;
  shown: number;
}) {
  const { t } = useTranslation("developer");
  const { n } = useNumbers();
  const searchRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(filters.q ?? "");
  useEffect(() => setText(filters.q ?? ""), [filters.q]);
  const set = (patch: Partial<MachineFilters>) => onFiltersChange({ ...filters, ...patch });
  const count = (test: (m: Machine) => boolean) => n(rows.filter(test).length);

  const statuses = CRED_STATUSES.filter((s) => rows.some((m) => m.status === s));
  const sponsorIds = [...new Set(rows.map((m) => m.personId).filter((id): id is string => !!id))];

  const tags: AppliedFilter[] = [];
  if (filters.kind)
    tags.push({
      id: "kind",
      label: t("machine.filters.kind"),
      value: t(`machine.kindPlural.${filters.kind}`),
    });
  if (filters.reach)
    tags.push({
      id: "reach",
      label: t("machine.filters.reach"),
      value: t(`machine.reach.${filters.reach}`),
    });
  if (filters.used)
    tags.push({
      id: "used",
      label: t("machine.filters.used"),
      value: t(`machine.used.${filters.used}`),
    });
  if (filters.sponsor)
    tags.push({
      id: "sponsor",
      label: t("machine.filters.sponsor"),
      value: personName(people.get(filters.sponsor)) ?? t("owner.unknown"),
    });
  if (filters.status)
    tags.push({
      id: "status",
      label: t("machine.filters.status"),
      value: t(`status.${filters.status}`),
    });
  if (filters.look)
    tags.push({
      id: "look",
      label: t("machine.band.needsALook"),
      value: t(`machine.looks.${filters.look}`),
    });

  return (
    <div className="ppl-toolbar">
      <div className="ppl-filters">
        <SearchField
          ref={searchRef}
          className="ppl-search"
          aria-label={t(`machine.search.${tab}`)}
          placeholder={t(`machine.search.${tab}`)}
          value={text}
          onValueChange={setText}
          onSearch={(q) => set({ q: q.trim() || undefined })}
        />
        {tab === "all" ? (
          <Select
            aria-label={t("machine.filters.kind")}
            className="ppl-filter"
            value={filters.kind ?? ANY}
            onValueChange={(v) => set({ kind: v ? (String(v) as MachineKind) : undefined })}
            items={[
              { value: ANY, label: t("machine.filters.anyKind") },
              ...(["key", "identity", "agent"] as const).map((k) => ({
                value: k,
                label: `${t(`machine.kindPlural.${k}`)} · ${count((m) => m.kind === k)}`,
              })),
            ]}
          />
        ) : null}
        {tab === "all" || tab === "identity" ? (
          <Select
            aria-label={t("machine.filters.reach")}
            className="ppl-filter"
            value={filters.reach ?? ANY}
            onValueChange={(v) => set({ reach: v ? (String(v) as Reach) : undefined })}
            items={[
              { value: ANY, label: t("machine.filters.anyReach") },
              ...REACH.map((r) => ({
                value: r,
                label: `${t(`machine.reach.${r}`)} · ${count((m) => reachOf(m.scopes) === r)}`,
              })),
            ]}
          />
        ) : null}
        {tab === "key" ? (
          <Select
            aria-label={t("machine.filters.used")}
            className="ppl-filter"
            value={filters.used ?? ANY}
            onValueChange={(v) => set({ used: v ? (String(v) as Used) : undefined })}
            items={[
              { value: ANY, label: t("machine.filters.anyUsed") },
              ...USED.map((u) => ({
                value: u,
                label: `${t(`machine.used.${u}`)} · ${count(
                  (m) =>
                    m.status !== "revoked" &&
                    m.status !== "expired" &&
                    usedOf(m.lastUsedAt, now) === u,
                )}`,
              })),
            ]}
          />
        ) : null}
        {tab === "agent" && sponsorIds.length > 1 ? (
          <Select
            aria-label={t("machine.filters.sponsor")}
            className="ppl-filter"
            value={filters.sponsor ?? ANY}
            onValueChange={(v) => set({ sponsor: v ? String(v) : undefined })}
            items={[
              { value: ANY, label: t("machine.filters.anySponsor") },
              ...sponsorIds.map((id) => ({
                value: id,
                label: `${personName(people.get(id)) ?? t("owner.unknown")} · ${count((m) => m.personId === id)}`,
              })),
            ]}
          />
        ) : null}
        {statuses.length > 1 ? (
          <Select
            aria-label={t("machine.filters.status")}
            className="ppl-filter"
            value={filters.status ?? ANY}
            onValueChange={(v) => set({ status: v ? (String(v) as CredStatus) : undefined })}
            items={[
              { value: ANY, label: t("machine.filters.anyStatus") },
              ...statuses.map((s) => ({
                value: s,
                label: `${t(`status.${s}`)} · ${count((m) => m.status === s)}`,
              })),
            ]}
          />
        ) : null}
      </div>
      {/* Only once something narrows the list (FilterTags shows its summary even with no tags,
          QTRX-15). */}
      {tags.length || filters.q ? (
        <FilterTags
          filters={tags}
          onRemove={(id) => set({ [id]: undefined })}
          onClear={() => onFiltersChange({ q: filters.q })}
          returnFocusTo={searchRef}
          summary={t("machine.filters.summary", { n: n(shown), total: n(rows.length) })}
        />
      ) : null}
    </div>
  );
}
