// The Settings parts of My account (src/modules/account/components/account-parts.tsx), with the
// same markup and classes (account.css, loaded with the console's styles), for the security pages
// that read as settings: Rate limits, Risk, IP rules, Log streams and Bots' detection. Here until
// the parts move to shared console code (redesign-findings §1.3); then this file goes.
import { Heading, Text } from "@qeetrix/react";
import { type ReactNode, useId } from "react";

/** A titled section: ruled, not boxed, with its own action at the end of its title. */
export function Section({
  title,
  description,
  status,
  action,
  children,
  id,
}: {
  title: string;
  description?: ReactNode;
  status?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  id?: string;
}) {
  const headingId = useId();
  return (
    <section className="account-section" aria-labelledby={headingId} id={id}>
      <header className="account-section-head">
        <div className="account-section-title">
          <span className="account-section-name">
            <Heading level={2} size="title-md" id={headingId}>
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

/** One thing in a section's list (in a `ul.account-rows`): an icon, its name, a line, its actions. */
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

/** One fact (in a `dl.account-details`): what it is, its value, a line on it, and its action. */
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

/** A fact being changed in place: its fields where the value was, its buttons where its action was. */
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

/** What went wrong with a form's request, in safe words, announced as it appears. */
export function Failure({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="account-failure">
      {children}
    </p>
  );
}
