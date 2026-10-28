import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  Select,
} from "@qeetrix/react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { DirectoryEvent } from "@/modules/directory/api/directory";
import type { DirectoryConnection } from "@/modules/directory/directory-model";
import { connectionName } from "@/modules/directory/sync-model";
import { PERIODS, type Period } from "@/modules/directory/sync-search";

const MONTH = 30 * 86_400_000;
export const ANY = "";

/**
 * A moment as people read it: "6 days ago" up to a month back, then the date; the full date and
 * time on hover. Until the library's RelativeTime (findings §5).
 */
export function When({ at, now }: { at: string; now: number }) {
  return (
    <time dateTime={at} title={formatDateTime(at, formatLocale())}>
      {whenText(at, now)}
    </time>
  );
}

/** When's words alone, for a sentence: "6 days ago", or the date past a month. */
export function whenText(at: string, now: number) {
  const locale = formatLocale();
  const ms = Date.parse(at);
  return now - ms > MONTH
    ? formatDate(at, locale, { dateStyle: "medium" })
    : formatRelativeTime(Math.min(ms, now), locale, now);
}

/** A connection's name for a row: SCIM's kind, an LDAP connection's own, or "Removed connection". */
export function useConnectionNames(connections: readonly DirectoryConnection[]) {
  const { t } = useTranslation("directory");
  const names = { scim: t("connections.kinds.scim"), removed: t("sync.removed") };
  return (id: string) => connectionName(connections, id, names);
}

/** What a run changed, in words: "1 person", "2 groups", "Nothing", "A check only". */
export function useChanged() {
  const { t } = useTranslation("directory");
  const locale = formatLocale();
  return (e: Pick<DirectoryEvent, "operation" | "status" | "users_synced" | "groups_synced">) => {
    if (e.operation === "test") return t("sync.changed.check");
    const parts = [
      e.users_synced
        ? t("sync.changed.people", {
            count: e.users_synced,
            n: formatNumber(e.users_synced, locale),
          })
        : "",
      e.groups_synced
        ? t("sync.changed.groups", {
            count: e.groups_synced,
            n: formatNumber(e.groups_synced, locale),
          })
        : "",
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : t("sync.changed.nothing");
  };
}

/** The period filter: 7, 30 or 90 days, the most the server keeps a list for. */
export function PeriodSelect({
  value,
  onChange,
}: {
  value: Period;
  onChange: (period: Period) => void;
}) {
  const { t } = useTranslation("directory");
  return (
    <Select
      aria-label={t("sync.period")}
      className="ppl-filter"
      value={value}
      onValueChange={(next) => {
        const period = PERIODS.find((p) => p === next);
        if (period) onChange(period);
      }}
      items={PERIODS.map((p) => ({ value: p, label: t(`sync.periods.${p}`) }))}
    />
  );
}

/** The connection filter: every connection, then each by name. */
export function ConnectionSelect({
  value,
  connections,
  onChange,
}: {
  value: string | undefined;
  connections: readonly DirectoryConnection[];
  onChange: (id: string | undefined) => void;
}) {
  const { t } = useTranslation("directory");
  const nameOf = useConnectionNames(connections);
  return (
    <Select
      aria-label={t("sync.connection")}
      className="ppl-filter"
      value={value ?? ANY}
      onValueChange={(next) => onChange(next ? String(next) : undefined)}
      items={[
        { value: ANY, label: t("sync.anyConnection") },
        ...connections.map((c) => ({ value: c.id, label: nameOf(c.id) })),
      ]}
    />
  );
}
