// The settings parts of the sign-in pages (Sign-in, Social, MFA): the same markup and classes as
// My account's (src/modules/account/components/account-parts.tsx), styled by its account.css, which
// the console loads globally. A module may reach another only through its barrel, and the account
// module doesn't offer them, so they're repeated here until they move to shared console code
// (redesign findings §1.3); then this file goes and its importers take them from there.
import { RefreshCwIcon } from "@qeetrix/icons";
import {
  Button,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  Heading,
  Skeleton,
  Text,
} from "@qeetrix/react";
import { Alert } from "@qeetrix/react/experimental";
import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { errorMessage } from "@/platform/errors/user-message";
import { isStepUpRequired } from "@/platform/security/step-up";

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
          {description && (
            <Text tone="subtle" size="sm">
              {description}
            </Text>
          )}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** One thing in a section's list: an icon, what it is, a line about it, and its actions. */
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
        {line && <small>{line}</small>}
      </span>
      {actions && <span className="account-row-actions">{actions}</span>}
    </li>
  );
}

/** A change of several steps, opened in place with the Ember bar: what it is, then its form. */
export function Panel({
  title,
  description,
  children,
  as: Tag = "div",
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  as?: "div" | "li";
}) {
  return (
    <Tag className="account-panel">
      <div className="account-panel-head">
        <Heading level={3} size="title-sm">
          {title}
        </Heading>
        {description && (
          <Text tone="subtle" size="sm">
            {description}
          </Text>
        )}
      </div>
      {children}
    </Tag>
  );
}

/** One fact: what it is, its value, and what can be done about it. Wrap in `dl.account-details`. */
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
        {hint && <small>{hint}</small>}
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
    <div className="account-detail" data-editing="">
      <dt>{label}</dt>
      <dd>{children}</dd>
      <dd className="account-detail-action account-detail-buttons">{buttons}</dd>
    </div>
  );
}

/**
 * What went wrong with a request, in safe words, announced as it appears. A step-up the person
 * cancelled isn't one: the step-up dialog has said so.
 */
export function Failure({ error }: { error: unknown }) {
  if (error == null || isStepUpRequired(error)) return null;
  return (
    <p role="alert" className="account-failure">
      {errorMessage(error)}
    </p>
  );
}

/** Where a section's content will be, while it loads. */
export function Loading({ rows = 2 }: { rows?: number }) {
  const { t } = useTranslation("authentication");
  return (
    <div className="account-loading" role="status" aria-label={t("methods.loading")}>
      {Array.from({ length: rows }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholders that never reorder
        <Skeleton key={index} lines={2} />
      ))}
    </div>
  );
}

/** Content that didn't load: what went wrong, in safe words, and a way to try again. */
export function LoadFailed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation("authentication");
  return (
    <Alert
      tone="danger"
      title={t("methods.loadFailed")}
      actions={
        <Button size="sm" variant="soft" icon={RefreshCwIcon} onClick={onRetry}>
          {t("methods.tryAgain")}
        </Button>
      }
    >
      {errorMessage(error)}
    </Alert>
  );
}

const MONTH = 30 * 24 * 60 * 60 * 1000;

// Until @qeetrix/react has RelativeTime (redesign findings §5, approved):
/**
 * A server time as people say it ("3 hours ago", "in 7 days"), with the full date and time on
 * hover; past about a month, the plain date reads better (redesign findings §2).
 */
export function When({ iso, now = Date.now() }: { iso: string; now?: number }) {
  const locale = formatLocale();
  const at = Date.parse(iso);
  return (
    <time dateTime={iso} title={formatDateTime(iso, locale)}>
      {Math.abs(at - now) > MONTH
        ? formatDate(iso, locale, { dateStyle: "medium" })
        : formatRelativeTime(at, locale, now)}
    </time>
  );
}

/** The words for `iso` that When shows, for a line of text. */
export function when(iso: string, now = Date.now()): string {
  const locale = formatLocale();
  const at = Date.parse(iso);
  return Math.abs(at - now) > MONTH
    ? formatDate(iso, locale, { dateStyle: "medium" })
    : formatRelativeTime(at, locale, now);
}
