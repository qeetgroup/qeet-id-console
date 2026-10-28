import { Heading, Text } from "@qeetrix/react";
import { type ReactNode, useId } from "react";

// The Settings parts, on My account's classes (account.css, loaded with the console's styles),
// until they move to shared console code (findings §1.3): a ruled section, and a fact in it.

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

/** One fact: what it is, its value with a line about it, and what you can do about it. */
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
