import { formatNumber, Select } from "@qeetrix/react";
import { type AppliedFilter, FilterTags, SearchField } from "@qeetrix/react/experimental";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { SUSPENSION_REASONS, type SuspendedUsersPage } from "@/modules/users/api/suspended";
import type { User } from "@/modules/users/api/users";
import {
  countBy,
  department,
  type PeopleFilters,
  RECENCY,
  REVIEWS,
  RISKS,
} from "@/modules/users/people-model";
import { roleLabel } from "./people-table";

const ANY = "";
// Each option's count is part of its label until Select items have a count of their own (QTRX-20).

// The filters that only make sense for everyone, and those only for suspended people: choosing a
// status clears the other kind.
const PEOPLE_ONLY = {
  group: undefined,
  role: undefined,
  dept: undefined,
  twostep: undefined,
  seen: undefined,
  look: undefined,
};
const SUSPENDED_ONLY = { reason: undefined, risk: undefined, review: undefined };

/**
 * One row above the table: search, status, then role, department, two-step and last active, each
 * with its counts; with Suspended chosen, reason, risk and review instead. Under it, what's
 * applied, as tags, with how many people that leaves.
 */
export function PeopleToolbar({
  filters,
  onFiltersChange,
  users,
  shown,
  suspended,
}: {
  filters: PeopleFilters;
  onFiltersChange: (next: PeopleFilters) => void;
  users: User[];
  shown: number;
  /** The suspended list's page, for its counts, while Suspended is chosen. */
  suspended?: SuspendedUsersPage;
}) {
  const { t } = useTranslation("users");
  const searchRef = useRef<HTMLInputElement>(null);
  // The field's text, which follows the address when a link elsewhere on the page changes it.
  const [text, setText] = useState(filters.q ?? "");
  useEffect(() => setText(filters.q ?? ""), [filters.q]);
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const set = (patch: Partial<PeopleFilters>) => onFiltersChange({ ...filters, ...patch });
  const pick = (key: keyof PeopleFilters) => (value: unknown) =>
    set({ [key]: value ? String(value) : undefined });
  const isSuspended = filters.status === "suspended";

  const statusCount = (status: User["status"]) => users.filter((u) => u.status === status).length;
  const roles = countBy(users.flatMap((u) => u.roles ?? []));
  const departments = countBy(users.map(department));
  const reasonCount = (key: string) => suspended?.reasons.find((r) => r.key === key)?.count ?? 0;
  const riskCount = (key: string) => suspended?.risks.find((r) => r.key === key)?.count ?? 0;

  const tags: AppliedFilter[] = [];
  if (filters.status)
    tags.push({
      id: "status",
      label: t("people.filters.status"),
      value: t(`people.filters.statuses.${filters.status}`),
    });
  if (filters.role)
    tags.push({ id: "role", label: t("people.columns.role"), value: roleLabel(t, filters.role) });
  if (filters.dept)
    tags.push({ id: "dept", label: t("people.filters.department"), value: filters.dept });
  if (filters.group)
    tags.push({
      id: "group",
      label: t("people.filters.group"),
      value: t("people.filters.inNoGroup"),
    });
  if (filters.twostep)
    tags.push({
      id: "twostep",
      label: t("people.filters.twoStep"),
      value: filters.twostep === "on" ? t("people.filters.on") : t("people.filters.off"),
    });
  if (filters.seen)
    tags.push({
      id: "seen",
      label: t("people.columns.active"),
      value: t(`people.recency.${filters.seen}`),
    });
  if (filters.look)
    tags.push({
      id: "look",
      label: t("people.band.needsALook"),
      value: t(`people.looks.${filters.look}`),
    });
  if (filters.reason)
    tags.push({
      id: "reason",
      label: t("people.suspended.reason"),
      value: t(
        `people.suspended.reasons.${filters.reason as (typeof SUSPENSION_REASONS)[number]}`,
        {
          defaultValue: filters.reason,
        },
      ),
    });
  if (filters.risk)
    tags.push({
      id: "risk",
      label: t("people.suspended.risk"),
      value: t(`people.suspended.risks.${filters.risk}`),
    });
  if (filters.review)
    tags.push({
      id: "review",
      label: t("people.suspended.review"),
      value: t(`people.suspended.reviews.${filters.review}`),
    });

  const summary = isSuspended
    ? t("people.suspended.summary", {
        n: n(suspended?.total ?? 0),
        manual: n(suspended?.summary.manual ?? 0),
        policy: n(suspended?.summary.policy ?? 0),
      })
    : t("people.filters.summary", { n: n(shown), total: n(users.length) });

  return (
    <div className="ppl-toolbar">
      <div className="ppl-filters">
        <SearchField
          ref={searchRef}
          className="ppl-search"
          aria-label={t("people.filters.search")}
          placeholder={t("people.filters.searchPlaceholder")}
          value={text}
          onValueChange={setText}
          onSearch={(q) => set({ q: q.trim() || undefined })}
        />
        <Select
          aria-label={t("people.filters.status")}
          className="ppl-filter"
          value={filters.status ?? ANY}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              ...(value === "suspended" ? PEOPLE_ONLY : SUSPENDED_ONLY),
              status: value ? (String(value) as PeopleFilters["status"]) : undefined,
            })
          }
          items={[
            { value: ANY, label: t("people.filters.anyStatus") },
            {
              value: "active",
              label: `${t("people.filters.statuses.active")} · ${n(statusCount("active"))}`,
            },
            {
              value: "suspended",
              label: `${t("people.filters.statuses.suspended")} · ${n(statusCount("suspended"))}`,
            },
          ]}
        />
        {isSuspended ? (
          <>
            <Select
              aria-label={t("people.suspended.reason")}
              className="ppl-filter"
              value={filters.reason ?? ANY}
              onValueChange={pick("reason")}
              items={[
                { value: ANY, label: t("people.suspended.anyReason") },
                ...SUSPENSION_REASONS.filter((key) => reasonCount(key) > 0).map((key) => ({
                  value: key,
                  label: `${t(`people.suspended.reasons.${key}`)} · ${n(reasonCount(key))}`,
                })),
              ]}
            />
            <Select
              aria-label={t("people.suspended.risk")}
              className="ppl-filter"
              value={filters.risk ?? ANY}
              onValueChange={pick("risk")}
              items={[
                { value: ANY, label: t("people.suspended.anyRisk") },
                ...RISKS.map((key) => ({
                  value: key,
                  label: `${t(`people.suspended.risks.${key}`)} · ${n(riskCount(key))}`,
                })),
              ]}
            />
            <Select
              aria-label={t("people.suspended.review")}
              className="ppl-filter"
              value={filters.review ?? ANY}
              onValueChange={pick("review")}
              items={[
                { value: ANY, label: t("people.suspended.anyReview") },
                ...REVIEWS.map((key) => ({
                  value: key,
                  label: t(`people.suspended.reviews.${key}`),
                })),
              ]}
            />
          </>
        ) : (
          <>
            <Select
              aria-label={t("people.columns.role")}
              className="ppl-filter"
              value={filters.role ?? ANY}
              onValueChange={pick("role")}
              items={[
                { value: ANY, label: t("people.filters.anyRole") },
                ...roles.map(([role, count]) => ({
                  value: role,
                  label: `${roleLabel(t, role)} · ${n(count)}`,
                })),
              ]}
            />
            <Select
              aria-label={t("people.filters.department")}
              className="ppl-filter"
              value={filters.dept ?? ANY}
              onValueChange={pick("dept")}
              items={[
                { value: ANY, label: t("people.filters.anyDepartment") },
                ...departments.map(([name, count]) => ({
                  value: name,
                  label: `${name} · ${n(count)}`,
                })),
              ]}
            />
            <Select
              aria-label={t("people.filters.twoStep")}
              className="ppl-filter"
              value={filters.twostep ?? ANY}
              onValueChange={pick("twostep")}
              items={[
                { value: ANY, label: t("people.filters.anyTwoStep") },
                { value: "on", label: t("people.signIn.on") },
                { value: "off", label: t("people.signIn.off") },
              ]}
            />
            <Select
              aria-label={t("people.columns.active")}
              className="ppl-filter"
              value={filters.seen ?? ANY}
              onValueChange={pick("seen")}
              items={[
                { value: ANY, label: t("people.filters.anyTime") },
                ...RECENCY.map((id) => ({ value: id, label: t(`people.recency.${id}`) })),
              ]}
            />
          </>
        )}
      </div>
      {/* Only once something narrows the list: with nothing applied, the count is the header's.
          FilterTags shows its summary even with no tags (QTRX-15). */}
      {tags.length || filters.q ? (
        <FilterTags
          filters={tags}
          onRemove={(id) =>
            onFiltersChange(
              id === "status"
                ? { ...filters, ...SUSPENDED_ONLY, status: undefined }
                : { ...filters, [id]: undefined },
            )
          }
          onClear={() => onFiltersChange({ q: filters.q })}
          returnFocusTo={searchRef}
          summary={summary}
        />
      ) : null}
    </div>
  );
}
