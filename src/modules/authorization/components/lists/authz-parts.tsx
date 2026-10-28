import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  Skeleton,
  Text,
} from "@qeetrix/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { Effect } from "@/modules/authorization/api/abac";

/** Formats a count in the reader's locale. */
export function useCount(): (value: number) => string {
  const locale = formatLocale();
  return (value: number) => formatNumber(value, locale);
}

const RESOURCE_NAMES = [
  "analytics",
  "apikey",
  "audit",
  "billing",
  "branding",
  "connection",
  "gdpr",
  "group",
  "policy",
  "role",
  "secret",
  "tenant",
  "user",
  "webhook",
] as const;
type KnownResource = (typeof RESOURCE_NAMES)[number];
const isKnown = (key: string): key is KnownResource =>
  (RESOURCE_NAMES as readonly string[]).includes(key);

/** A resource's name in words, for Qeet ID's own; any other is its key, as your policies name it. */
export function useResourceName(): (key: string) => string {
  const { t } = useTranslation("authorization");
  return (key: string) => (isKnown(key) ? t(`lists.resourceNames.${key}`) : key);
}

/** An action's name for a column header; read and write in words, any other as it is. */
export function useActionName(): (action: string) => string {
  const { t } = useTranslation("authorization");
  return (action: string) =>
    action === "read" || action === "write" ? t(`lists.actionNames.${action}`) : action;
}

/** A resource: its name over its key, or just the key when Qeet ID has no name for it. */
export function ResourceName({ resource }: { resource: string }) {
  const name = useResourceName();
  return isKnown(resource) ? (
    <Two main={name(resource)} sub={resource} mono />
  ) : (
    <span className="authz-mono">{resource}</span>
  );
}

/** A cell of two lines: what it is, then one subtle line about it. */
export function Two({
  main,
  sub,
  mono,
  end,
}: {
  main: ReactNode;
  sub?: ReactNode;
  mono?: boolean;
  end?: boolean;
}) {
  return (
    <span className={end ? "authz-two is-end" : "authz-two"}>
      <span className="authz-two-main">{main}</span>
      {sub ? <small className={mono ? "authz-mono" : undefined}>{sub}</small> : null}
    </span>
  );
}

/** A policy's effect: the word, not a coloured badge (an effect is a kind, not a status). */
export function EffectWord({ effect }: { effect: Effect }) {
  const { t } = useTranslation("authorization");
  return <span className="authz-effect">{t(`lists.common.effect.${effect}`)}</span>;
}

const MONTH_MS = 30 * 86_400_000;

/**
 * When something happened: relative within about a month, a plain date after it, and the full
 * date and time on hover (the approved RelativeTime, until the library has it).
 */
export function When({ at, now }: { at: string; now: number }) {
  const locale = formatLocale();
  const ms = Math.min(Date.parse(at), now);
  return (
    <time dateTime={at} title={formatDateTime(at, locale)} className="authz-when">
      {now - ms > MONTH_MS
        ? formatDate(at, locale, { dateStyle: "medium" })
        : formatRelativeTime(ms, locale, now)}
    </time>
  );
}

/** "None", subtly, where a cell has nothing to say. */
export function NoneCell({ children }: { children?: ReactNode }) {
  const { t } = useTranslation("authorization");
  return <Text tone="subtle">{children ?? t("lists.common.none")}</Text>;
}

/** The band's place while its numbers load, so the header doesn't jump when they arrive. */
export function BandPlaceholder({ cells }: { cells: 3 | 4 }) {
  return (
    <div className={cells === 3 ? "ppl-band is-three" : "ppl-band"} aria-hidden="true">
      {Array.from({ length: cells }, (_, cell) => cell).map((cell) => (
        <div key={cell} className="ppl-cell">
          <Skeleton className="ppl-skeleton-label" />
          <Skeleton className="ppl-skeleton-value" />
          <Skeleton lines={2} />
        </div>
      ))}
    </div>
  );
}

/** The person a user ID names, from the people list, or the ID's start when they aren't in it. */
export function personLabel(
  person: { display_name?: string | null; email: string } | undefined,
  id: string,
): string {
  return person ? person.display_name?.trim() || person.email : id.slice(0, 8);
}
