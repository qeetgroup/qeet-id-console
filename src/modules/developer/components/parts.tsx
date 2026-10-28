import {
  Badge,
  type BadgeTone,
  Drawer,
  DrawerBody,
  DrawerContent,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  Skeleton,
  Tooltip,
} from "@qeetrix/react";
import { AvatarItem, CopyButton } from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { SplitBar } from "@/modules/dashboard";
import type { User } from "@/modules/users";
import { OneTimeSecret } from "@/shared/components/one-time-secret";
import { type CredStatus, DAY } from "../machine-model";

/** The page's locale and a number formatter in it. */
export function useNumbers() {
  const locale = formatLocale();
  return { locale, n: (value: number) => formatNumber(value, locale) };
}

const sentence = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/**
 * A date as people read it in a list: relative within a month ("3 days ago", "In 5 days"), a plain
 * date after that (a relative "last year" on every row says nothing), the full date on hover.
 * Nothing reads as `none` ("Never", "—").
 */
export function When({ at, now, none }: { at?: string | null; now: number; none?: ReactNode }) {
  const { locale } = useNumbers();
  if (!at) return <span className="dev-subtle">{none ?? "—"}</span>;
  const time = Date.parse(at);
  const text =
    Math.abs(time - now) <= 30 * DAY
      ? sentence(formatRelativeTime(time, locale, now))
      : formatDate(at, locale, { dateStyle: "medium" });
  return (
    <time
      className="dev-nowrap"
      dateTime={at}
      title={formatDateTime(at, locale, { dateStyle: "long" })}
    >
      {text}
    </time>
  );
}

/** A credential's name over the identifier people match it by (a prefix, a client ID). */
export function NameCell({
  name,
  ident,
  copy,
  shorten = true,
}: {
  name: ReactNode;
  ident: string;
  /** The copy button's label; without it, no button. */
  copy?: string;
  /** Show only the start of a long identifier (the button copies all of it). */
  shorten?: boolean;
}) {
  const shown = shorten && ident.length > 12 ? `${ident.slice(0, 8)}…` : ident;
  return (
    <span className="dev-name">
      <strong>{name}</strong>
      <span className="dev-ident">
        <code title={shown === ident ? undefined : ident}>{shown}</code>
        {copy ? <CopyButton value={ident} label={copy} size="sm" variant="ghost" /> : null}
      </span>
    </span>
  );
}

/**
 * Scopes as code: the first `max`, the rest on hover. None at all: the server denies a machine
 * every route its scopes don't match, so it can call nothing.
 */
export function Scopes({ scopes, max = 2 }: { scopes: readonly string[]; max?: number }) {
  const { t } = useTranslation("developer");
  if (!scopes.length)
    return (
      <Badge tone="warning" size="sm">
        {t("scopes.none")}
      </Badge>
    );
  const shown = scopes.slice(0, max);
  const rest = scopes.slice(max);
  return (
    <span className="dev-scopes">
      {shown.map((s) => (
        <code key={s}>{s}</code>
      ))}
      {rest.length ? (
        <Tooltip content={rest.join(", ")}>
          <button type="button" className="dev-more">
            {t("scopes.more", { count: rest.length })}
          </button>
        </Tooltip>
      ) : null}
    </span>
  );
}

const STATUS_TONE: Record<CredStatus, BadgeTone> = {
  active: "success",
  expiring: "warning",
  suspended: "warning",
  expired: "danger",
  revoked: "neutral",
  disabled: "neutral",
};

/** A credential's status, in the one vocabulary every credential page uses. */
export function CredBadge({ status }: { status: CredStatus }) {
  const { t } = useTranslation("developer");
  return (
    <Badge tone={STATUS_TONE[status]} size="sm">
      {t(`status.${status}`)}
    </Badge>
  );
}

/** Who a credential belongs to or answers to: a person, or the organisation. */
export function Owner({ id, people }: { id: string | null; people: ReadonlyMap<string, User> }) {
  const { t } = useTranslation("developer");
  if (!id) return <span className="dev-subtle">{t("owner.organisation")}</span>;
  const person = people.get(id);
  // Without the directory (no user.read) nobody's name is known; with it, a missing one has left.
  if (!person)
    return (
      <span className="dev-subtle">{people.size ? t("owner.unknown") : t("owner.person")}</span>
    );
  return (
    <AvatarItem
      name={person.display_name?.trim() || person.email}
      description={person.display_name?.trim() ? person.email : undefined}
      size="sm"
    />
  );
}

/** People by ID, for owners and sponsors. */
export const peopleById = (items: readonly User[] | undefined) =>
  new Map((items ?? []).map((u) => [u.id, u] as const));

export const personName = (u: User | undefined) => u?.display_name?.trim() || u?.email;

// ── The header's band, on the Users band's parts (people.css, loaded with the console) ─────────

type To = { to: string; search?: Record<string, unknown> };
// The band links into lists the module's routes own; their search types are each route's.
const RouterLink = ({ link, children }: { link: To; children: ReactNode }) => (
  <Link to={link.to as never} search={link.search as never}>
    {children}
  </Link>
);

/** A band cell with a number: its label, the value, a line about it, then a chart or a link. */
export function BandCount({
  label,
  value,
  note,
  warn,
  chart,
  link,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  warn?: boolean;
  chart?: ReactNode;
  link?: { text: string } & To;
}) {
  return (
    <div className="ppl-cell">
      <dt className="ppl-label">{label}</dt>
      <dd className="ppl-value">{value}</dd>
      {note ? <dd className={warn ? "ppl-note is-warning" : "ppl-note"}>{note}</dd> : null}
      {chart ? <dd className="ppl-chart">{chart}</dd> : null}
      {link ? (
        <dd className="ppl-link">
          <RouterLink link={link}>{link.text}</RouterLink>
        </dd>
      ) : null}
    </div>
  );
}

export type SplitPart = { id: string; count: number; label: string; color: string; link?: To };

/** A band cell that splits a whole: a bar, then a legend whose items open the list filtered. */
export function BandSplit({ label, parts }: { label: string; parts: readonly SplitPart[] }) {
  const { n } = useNumbers();
  return (
    <div className="ppl-cell">
      <dt className="ppl-label">{label}</dt>
      <dd className="ppl-recency">
        <SplitBar
          label={parts.map((p) => `${p.label}: ${n(p.count)}`).join(", ")}
          parts={parts.map((p) => ({ value: p.count, color: p.color }))}
        />
      </dd>
      <dd className="ppl-recency-legend">
        <ul>
          {parts.map((p) => {
            const body = (
              <>
                <span className="dev-swatch" style={{ background: p.color }} aria-hidden="true" />
                <b>{n(p.count)}</b> {p.label}
              </>
            );
            return (
              <li key={p.id} className={p.count ? undefined : "is-zero"}>
                {p.link ? (
                  <RouterLink link={p.link}>{body}</RouterLink>
                ) : (
                  <span className="dev-legend-item">{body}</span>
                )}
              </li>
            );
          })}
        </ul>
      </dd>
    </div>
  );
}

export type Look = {
  id: string;
  label: string;
  count: number;
  danger?: boolean;
  link?: To;
  /** A place on this page instead, such as a section. */
  href?: string;
};

/** The band's "Needs a look": each thing to act on, with how many, opening the list on them. */
export function BandLooks({ label, looks }: { label: string; looks: readonly Look[] }) {
  const { n } = useNumbers();
  return (
    <div className="ppl-cell">
      <dt className="ppl-label">{label}</dt>
      <dd className="ppl-looks">
        <ul>
          {looks.map((look) => {
            const body = (
              <>
                <span>{look.label}</span>
                <b className={look.count && look.danger ? "is-danger" : undefined}>
                  {n(look.count)}
                </b>
              </>
            );
            return (
              <li key={look.id} className={look.count ? undefined : "is-zero"}>
                {look.link ? (
                  <RouterLink link={look.link}>{body}</RouterLink>
                ) : look.href ? (
                  <a href={look.href}>{body}</a>
                ) : (
                  <span className="dev-look">{body}</span>
                )}
              </li>
            );
          })}
        </ul>
      </dd>
    </div>
  );
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

/** One ruled section of a record page: its heading, an action at its end, one line on it. */
export function DevSection({
  id,
  title,
  action,
  note,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  note?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="dev-section" aria-labelledby={id}>
      <div className="dev-section-head">
        <h2 id={id} className="dev-section-title">
          {title}
        </h2>
        {action}
      </div>
      {note ? <p className="dev-section-note">{note}</p> : null}
      {children}
    </section>
  );
}

/**
 * The step after a create (or a rotation): a value the server returns once. The drawer isn't
 * dismissible, so a stray click or Escape can't lose it; only Done closes it.
 */
export function ShownOnceDrawer({
  open,
  title,
  description,
  warning,
  why,
  values,
  onDone,
  children,
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  /** "Copy the key now. You won't see it again." */
  warning: ReactNode;
  /** Why it can't be shown again. */
  why: ReactNode;
  values: { label?: string; value: string }[];
  onDone: () => void;
  /** How to use it, e.g. a code sample. */
  children?: ReactNode;
}) {
  const { t } = useTranslation("developer");
  return (
    <Drawer open={open} dismissible={false}>
      <DrawerContent title={title} description={description} size="md">
        <DrawerBody>
          <OneTimeSecret
            title={warning}
            description={why}
            values={values}
            dismissLabel={t("shownOnce.done")}
            onDismiss={onDone}
          >
            {children}
          </OneTimeSecret>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
