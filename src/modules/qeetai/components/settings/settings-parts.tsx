// The settings parts every rebuilt Settings page draws (My account's account-parts.tsx, styled by
// account.css, which styles.css loads for the whole console): the same markup and classes, so
// this page looks as those do. Swap them for the shared parts once they move to platform code
// (redesign-findings §1.3); they live in the account module, which a module can't import.
import { Heading, Text } from "@qeetrix/react";
import { type ReactNode, useId } from "react";

/** A titled section: ruled, not boxed, with its own action at the end of its title. */
export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
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
          </span>
          {description && (
            <Text tone="subtle" size="sm">
              {description}
            </Text>
          )}
        </div>
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

/** A change of several steps, opened under its row with the Ember bar: what it is, then its form. */
export function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="account-panel">
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
    </li>
  );
}

/** One fact: what it is, then what's true of it. */
export function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="account-detail">
      <dt>{label}</dt>
      <dd>
        <span className="account-detail-value">{children}</span>
      </dd>
    </div>
  );
}
