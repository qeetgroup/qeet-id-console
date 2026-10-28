import { CircleCheckIcon, CircleDashedIcon, CircleXIcon, LoaderCircleIcon } from "@qeetrix/icons";
import { Badge, Card, Heading, Text } from "@qeetrix/react";
import { CopyButton, Steps } from "@qeetrix/react/experimental";
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
 * A value someone pastes into the other system: what it is, the value, where it goes, Copy.
 * Library gap (new): CopyField (redesign-findings §5).
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
const CHECK_ICON = {
  ok: CircleCheckIcon,
  fail: CircleXIcon,
  todo: CircleDashedIcon,
  running: LoaderCircleIcon,
} as const;

/**
 * A test's checks, each with its result in words as well as its icon (Passed, Failed, Not run).
 * Library gap (new): a checks-result list (redesign-findings §5).
 */
export function CheckList({ checks, footer }: { checks: Check[]; footer?: ReactNode }) {
  const { t } = useTranslation("connections");
  return (
    <div className="cx-checks">
      <ul>
        {checks.map((c) => {
          const Icon = CHECK_ICON[c.state];
          return (
            <li key={c.label} data-state={c.state}>
              <Icon size={16} aria-hidden="true" />
              <span className="cx-check-text">
                <strong>{c.label}</strong>
                {c.detail ? <small>{c.detail}</small> : null}
              </span>
              <span className="cx-check-word">{t(`parts.check.${c.state}`)}</span>
            </li>
          );
        })}
      </ul>
      {footer ? <div className="cx-checks-foot">{footer}</div> : null}
    </div>
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
