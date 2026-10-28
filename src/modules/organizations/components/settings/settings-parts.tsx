import { RefreshCwIcon } from "@qeetrix/icons";
import { Button, Heading, Skeleton, Text } from "@qeetrix/react";
import { Alert } from "@qeetrix/react/experimental";
import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";

import { errorMessage } from "@/platform/errors/user-message";

// The Settings page parts My account approved (src/modules/account/components/account-parts.tsx),
// with its markup and its global classes (account.css), so Settings › General, Domains, Security
// and My account read as one. A module reaches another only through its barrel, which doesn't
// carry components, so they're mirrored here until they move to shared console code (redesign
// findings §1.3); then this file goes. Section headings are h2: these pages' title is the h1.

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

/** One fact: what it is, its value, a line about it, and what you can do about it. */
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

/** A fact whose change takes several steps: it opens under its label, at full width. */
export function OpenDetail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="account-detail account-detail-open" data-editing="">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** What went wrong with a change, in safe words, announced as it appears. */
export function Failure({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="account-failure">
      {children}
    </p>
  );
}

/** Where a page's facts will be, while they load. */
export function Loading({ rows = 3 }: { rows?: number }) {
  const { t } = useTranslation("organizations");
  return (
    <div className="account-loading" role="status" aria-label={t("settings.loading")}>
      {Array.from({ length: rows }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholders that never reorder
        <Skeleton key={index} lines={2} />
      ))}
    </div>
  );
}

/** Facts that didn't load: what went wrong, in safe words, and a way to try again. */
export function LoadFailed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation("organizations");
  return (
    <Alert
      tone="danger"
      title={t("settings.loadFailed")}
      actions={
        <Button size="sm" variant="soft" icon={RefreshCwIcon} onClick={onRetry}>
          {t("settings.tryAgain")}
        </Button>
      }
    >
      {errorMessage(error)}
    </Alert>
  );
}
