import { Badge, Card, Heading, Text } from "@qeetrix/react";
import {
  CheckItem,
  CopyButton,
  CheckList as QeetrixCheckList,
  Steps,
} from "@qeetrix/react/experimental";
import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";

import { STATUS_TONE, type SetupStatus } from "@/modules/authentication/connections-model";

// The parts every connection page shares, so they read as one family: My account's ruled
// sections and facts (account.css; the shared parts move out of the account module with
// redesign-findings §1.3, until then the same markup is written here), a connection's status in
// its one word, the setup steps beside the sections, values to copy, a test's checks and the
// danger zone last.

/** A connection's status in its one word, in its tone. */
export function StatusBadge({ status, size }: { status: SetupStatus; size?: "sm" | "md" }) {
  const { t } = useTranslation("connections");
  return (
    <Badge tone={STATUS_TONE[status]} size={size}>
      {t(`status.${status}`)}
    </Badge>
  );
}

/** A titled section: ruled, not boxed, with its own action at the end of its title. */
export function Section({
  id,
  title,
  description,
  status,
  action,
  children,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  status?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  const auto = useId();
  const headingId = id ? `${id}-title` : auto;
  return (
    <section className="account-section" id={id} aria-labelledby={headingId}>
      <header className="account-section-head">
        <div className="account-section-title">
          <span className="account-section-name">
            <Heading level={2} size="title-md" id={headingId}>
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

/** One fact: what it is, its value, a line on what it means, and what you can do about it. */
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

/** A value already stored, in code type, broken anywhere so a long URL never overflows. */
export function Mono({ children }: { children: ReactNode }) {
  return <span className="account-mono cx-break">{children}</span>;
}

/**
 * A value someone pastes into the other system: what it is, the value, where it goes, Copy. A
 * Detail row, so it shares one description list with the facts beside it (Qeetrix's CopyField row
 * isn't a description-list item).
 */
export function CopyRow({
  label,
  value,
  hint,
  copyLabel,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  copyLabel: string;
}) {
  const { t } = useTranslation("connections");
  return (
    <Detail
      label={label}
      hint={hint}
      action={
        <CopyButton value={value} label={copyLabel}>
          {t("parts.copy")}
        </CopyButton>
      }
    >
      <Mono>{value}</Mono>
    </Detail>
  );
}

/** "Not set", quieter than a value. */
export function None({ children }: { children: ReactNode }) {
  return <span className="cx-none">{children}</span>;
}

export type Check = {
  label: string;
  detail?: ReactNode;
  state: "ok" | "fail" | "todo" | "running";
};
const CHECK_STATUS = {
  ok: "passed",
  fail: "failed",
  todo: "pending",
  running: "running",
} as const;

/** A test's checks (Qeetrix's CheckList), each with its result in words as well as its icon. */
export function CheckList({ checks, footer }: { checks: Check[]; footer?: ReactNode }) {
  const { t } = useTranslation("connections");
  const messages = {
    passed: t("parts.check.ok"),
    failed: t("parts.check.fail"),
    pending: t("parts.check.todo"),
    running: t("parts.check.running"),
  };
  return (
    <QeetrixCheckList footer={footer}>
      {checks.map((c) => (
        <CheckItem
          key={c.label}
          title={c.label}
          detail={c.detail}
          status={CHECK_STATUS[c.state]}
          messages={messages}
        />
      ))}
    </QeetrixCheckList>
  );
}

/** The last thing on a setup page: what ending it does to people, with its one red button. */
export function DangerZone({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card
      tone="danger"
      title={title}
      level={2}
      description={description}
      className="account-danger"
    >
      <span className="account-panel-actions">{children}</span>
    </Card>
  );
}

/** The setup layout: the steps in a column (a strip when narrow), the step sections beside it. */
export function SetupLayout({
  label,
  steps,
  current,
  children,
}: {
  label: string;
  steps: { label: string; description?: ReactNode }[];
  current: number;
  children: ReactNode;
}) {
  return (
    <div className="cx-setup">
      <nav className="cx-setup-steps" aria-label={label}>
        <Steps steps={steps} current={current} orientation="vertical" />
      </nav>
      <div className="cx-setup-body">{children}</div>
    </div>
  );
}
