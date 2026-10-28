import { SearchIcon } from "@qeetrix/icons";
import { formatNumber, Select } from "@qeetrix/react";
import { type AppliedFilter, Combobox, FilterTags, SearchField } from "@qeetrix/react/experimental";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { formatEventTitle } from "@/modules/activity";
import {
  ACTION_GROUPS,
  type ActionGroup,
  type AuditSearch,
  RESOURCE_TYPES,
} from "@/modules/security/audit-model";
import type { Person } from "../use-people";
import { resourceLabel } from "./audit-cells";

const ANY = "";
// Each option's count is part of its label until Select items have a count of their own (QTRX-20).

/**
 * One row above the log: the view, a search, then who did it, what and to what. Under it, once
 * something narrows the log, what's applied as tags. The server has no time filter or total, so
 * neither is offered; the summary counts this page.
 */
export function AuditToolbar({
  search,
  onSearchChange,
  people,
  viewSwitch,
  onPage,
}: {
  search: AuditSearch;
  onSearchChange: (next: AuditSearch) => void;
  people: ReadonlyMap<string, Person>;
  viewSwitch: ReactNode;
  onPage: number;
}) {
  const { t } = useTranslation("security");
  const searchRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(search.q ?? "");
  useEffect(() => setText(search.q ?? ""), [search.q]);
  const set = (patch: Partial<AuditSearch>) =>
    onSearchChange({ ...search, ...patch, event: undefined });

  const actors = useMemo(
    () =>
      [...people.values()]
        .map((p) => ({ value: p.id, label: p.name, description: p.email }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [people],
  );
  const actions = useMemo(() => {
    const groups = (Object.keys(ACTION_GROUPS) as ActionGroup[]).map((group) => ({
      label: t(`audit.actionGroups.${group}`),
      items: ACTION_GROUPS[group].map((action) => ({
        value: action as string,
        label: formatEventTitle({ type: action }),
        description: action as string,
      })),
    }));
    // A filter set from elsewhere (a link, the address) stays choosable.
    const known = groups.some((g) => g.items.some((i) => i.value === search.action));
    if (search.action && !known) {
      groups.unshift({
        label: t("audit.actionGroups.current"),
        items: [
          {
            value: search.action,
            label: formatEventTitle({ type: search.action }),
            description: search.action,
          },
        ],
      });
    }
    return groups;
  }, [t, search.action]);

  const actorName = (id: string) => people.get(id)?.name ?? id.slice(0, 8);
  const tags: AppliedFilter[] = [];
  if (search.actor_user_id)
    tags.push({
      id: "actor_user_id",
      label: t("audit.filters.actor"),
      value: actorName(search.actor_user_id),
    });
  if (search.action)
    tags.push({
      id: "action",
      label: t("audit.filters.action"),
      value: formatEventTitle({ type: search.action }),
    });
  if (search.resource_type)
    tags.push({
      id: "resource_type",
      label: t("audit.filters.resource"),
      value: resourceLabel(t, search.resource_type),
    });

  return (
    <div className="ppl-toolbar">
      <div className="ppl-filters">
        {viewSwitch}
        <SearchField
          ref={searchRef}
          className="ppl-search"
          aria-label={t("audit.filters.search")}
          placeholder={t("audit.filters.searchPlaceholder")}
          value={text}
          onValueChange={setText}
          onSearch={(q) => set({ q: q.trim() || undefined })}
        />
        {actors.length || search.actor_user_id ? (
          <Combobox
            aria-label={t("audit.filters.actor")}
            className="ppl-filter"
            placeholder={t("audit.filters.actor")}
            icon={SearchIcon}
            items={
              search.actor_user_id && !people.has(search.actor_user_id)
                ? [
                    { value: search.actor_user_id, label: actorName(search.actor_user_id) },
                    ...actors,
                  ]
                : actors
            }
            value={search.actor_user_id ?? null}
            onValueChange={(value) => set({ actor_user_id: value ? String(value) : undefined })}
          />
        ) : null}
        <Combobox
          aria-label={t("audit.filters.action")}
          className="ppl-filter"
          placeholder={t("audit.filters.action")}
          items={actions}
          value={search.action ?? null}
          onValueChange={(value) => set({ action: value ? String(value) : undefined })}
        />
        <Select
          aria-label={t("audit.filters.resource")}
          className="ppl-filter"
          value={search.resource_type ?? ANY}
          onValueChange={(value) => set({ resource_type: value ? String(value) : undefined })}
          items={[
            { value: ANY, label: t("audit.filters.anyResource") },
            ...(search.resource_type &&
            !(RESOURCE_TYPES as readonly string[]).includes(search.resource_type)
              ? [{ value: search.resource_type, label: resourceLabel(t, search.resource_type) }]
              : []),
            ...RESOURCE_TYPES.map((type) => ({ value: type, label: resourceLabel(t, type) })),
          ]}
        />
      </div>
      {/* Only once something narrows the log (FilterTags shows its summary even with none,
          QTRX-15). */}
      {tags.length || search.q ? (
        <FilterTags
          filters={tags}
          onRemove={(id) => set({ [id]: undefined })}
          onClear={() => onSearchChange({ q: search.q })}
          returnFocusTo={searchRef}
          summary={t("audit.filters.summary", { n: formatNumber(onPage, formatLocale()) })}
        />
      ) : null}
    </div>
  );
}
