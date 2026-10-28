// The parts every Compliance view is made of. Section, Item and Detail have My account's markup and
// classes (account.css, loaded with the console's styles), so the views read as the Settings pages
// do, until those parts move to shared console code (redesign findings §1.3).

import { CircleAlertIcon, CircleCheckIcon, CircleDashedIcon, InfoIcon } from "@qeetrix/icons";
import {
  Badge,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  Heading,
  Text,
} from "@qeetrix/react";
import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { ControlStatus } from "@/modules/compliance/api/evidence";

/** A titled section: ruled, not boxed, with its own action at the end of its title. */
export function Section({
  title,
  description,
  status,
  action,
  children,
}: {
  title: string;
  description?: ReactNode;
  status?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <section className="account-section" aria-labelledby={id}>
      <header className="account-section-head">
        <div className="account-section-title">
          <span className="account-section-name">
            <Heading level={2} size="title-md" id={id}>
              {title}
            </Heading>
            {status}
          </span>
          {description ? (
            <Text tone="subtle" size="sm">
              {description}
            </Text>
          ) : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** One thing in a section's list (wrap them in `ul.account-rows`): icon, name, a line, actions. */
export function Item({
  icon,
  name,
  badge,
  line,
  actions,
}: {
  icon: ReactNode;
  name: ReactNode;
  badge?: ReactNode;
  line?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <li className="account-row">
      <span className="account-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="account-row-text">
        <span className="account-row-name">
          <strong>{name}</strong>
          {badge}
        </span>
        {line ? <small>{line}</small> : null}
      </span>
      {actions ? <span className="account-row-actions">{actions}</span> : null}
    </li>
  );
}

/** One fact (wrap them in `dl.account-details`): what it is, its value, and its action. */
export function Detail({
  label,
  children,
  hint,
  action,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="account-detail">
      <dt>{label}</dt>
      <dd>
        <span className="account-detail-value">{children}</span>
        {hint ? <small>{hint}</small> : null}
      </dd>
      <dd className="account-detail-action">{action}</dd>
    </div>
  );
}

/** A fact being changed in place: its field where the value was, its buttons where its action was. */
export function EditingDetail({
  label,
  children,
  buttons,
}: {
  label: string;
  children: ReactNode;
  buttons: ReactNode;
}) {
  return (
    <div className="account-detail cmp-edit" data-editing="">
      <dt>{label}</dt>
      <dd>{children}</dd>
      <dd className="account-detail-action account-detail-buttons">{buttons}</dd>
    </div>
  );
}

/** A view's opening facts, ruled off from its sections: a few columns, then a note. */
export function Facts({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="cmp-facts">
      {children}
      {note ? (
        <p className="cmp-note">
          <InfoIcon aria-hidden="true" />
          <span>{note}</span>
        </p>
      ) : null}
    </div>
  );
}

/** A fact's value and the line under it. */
export function Fact({ value, sub }: { value: ReactNode; sub?: ReactNode }) {
  return (
    <span className="cmp-fact">
      <span className="cmp-fact-value">{value}</span>
      {sub ? <small>{sub}</small> : null}
    </span>
  );
}

const CONTROL_LOOK = {
  pass: { tone: "success", icon: CircleCheckIcon },
  fail: { tone: "danger", icon: CircleAlertIcon },
  na: { tone: "neutral", icon: CircleDashedIcon },
} as const;

/** A check's result as a word with its icon: Pass, Fail or No evidence. */
export function ControlBadge({ status }: { status: ControlStatus }) {
  const { t } = useTranslation("compliance");
  const look = CONTROL_LOOK[status];
  return (
    <Badge tone={look.tone} size="sm" icon={look.icon}>
      {t(`evidence.status.${status}`)}
    </Badge>
  );
}

const MONTH = 30 * 86_400_000;

/**
 * A moment, relative ("3 weeks ago", "in 2 weeks"), with the full date and time on hover; past
 * about a month it's the plain date, as "last year" on every row says nothing.
 */
export function When({ iso, now }: { iso: string; now: number }) {
  const locale = formatLocale();
  const at = new Date(iso).getTime();
  return (
    <time dateTime={iso} title={formatDateTime(iso, locale)}>
      {Math.abs(now - at) > MONTH ? formatDate(iso, locale) : formatRelativeTime(at, locale, now)}
    </time>
  );
}

/** A criteria code ("CC6.1"), in the code face. */
export function Code({ children }: { children: ReactNode }) {
  return <span className="cmp-code">{children}</span>;
}
