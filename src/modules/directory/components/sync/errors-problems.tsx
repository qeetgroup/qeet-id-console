import {
  CircleCheckIcon,
  CircleXIcon,
  PencilIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from "@qeetrix/icons";
import { Badge, Button, formatDate, formatNumber, Heading, Text } from "@qeetrix/react";
import { Alert } from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { DirectoryEvent } from "@/modules/directory/api/directory";
import type { DirectoryConnection } from "@/modules/directory/directory-model";
import { type Cause, type Problem, portOf, reach } from "@/modules/directory/sync-model";
import { whenText } from "./sync-parts";

/** The steps to fix a cause: every cause has three, a lead and a sentence each. */
export function FixSteps({
  cause,
  server,
  port,
}: {
  cause: Cause;
  /** The connection's address and port, for the steps that name them. */
  server: string;
  port: string;
}) {
  const { t } = useTranslation("directory");
  return (
    <ol className="sync-steps">
      {(["1", "2", "3"] as const).map((step) => (
        <li key={step}>
          <strong>{t(`errors.causes.${cause}.steps.${step}.lead`)}</strong>{" "}
          <Trans
            t={t}
            i18nKey={`errors.causes.${cause}.steps.${step}.text`}
            values={{ server, port }}
            components={{ code: <code /> }}
          />
        </li>
      ))}
    </ol>
  );
}

/** The server's own words about a failure, for whoever runs the directory. */
export function TechnicalLine({ event }: { event: DirectoryEvent }) {
  const { t } = useTranslation("directory");
  return (
    <Text size="sm" tone="subtle" className="sync-tech">
      {t("sync.technical")}{" "}
      <code>
        {[event.error_code, `HTTP ${event.http_status}`, event.message].filter(Boolean).join(" · ")}
      </code>
    </Text>
  );
}

/** Where a problem's fix lives, if it's somewhere else in the console. */
function fixLink(cause: Cause, connectionId: string) {
  switch (cause) {
    case "unreachable":
    case "signInRefused":
      return { to: "/directory/connections/ldap" as const, search: undefined };
    case "denied":
      return { to: "/directory/connections/scim" as const, search: undefined };
    case "refusedData":
      return { to: "/directory/attribute-mappings" as const, search: { connection: connectionId } };
    default:
      return null;
  }
}

/**
 * The open problems, each in its own ruled panel: what happened, to whom, and how to fix it, with
 * the fix as its main action, Check again for a connection check, and Mark resolved. A problem
 * whose connection has since passed a check (its health, or a check from here) says so.
 */
export function ProblemList({
  problems,
  connections,
  canWrite,
  pending,
  onCheckAgain,
  onResolve,
  now,
}: {
  problems: readonly Problem[];
  connections: readonly DirectoryConnection[];
  canWrite: boolean;
  pending: boolean;
  onCheckAgain: (events: readonly DirectoryEvent[]) => Promise<{ closed: number } | undefined>;
  onResolve: (events: readonly DirectoryEvent[]) => void;
  now: number;
}) {
  return (
    <ul className="sync-problems">
      {problems.map((p) => (
        <ProblemItem
          key={p.key}
          problem={p}
          connection={connections.find((c) => c.id === p.connectionId)}
          canWrite={canWrite}
          pending={pending}
          onCheckAgain={onCheckAgain}
          onResolve={onResolve}
          now={now}
        />
      ))}
    </ul>
  );
}

function ProblemItem({
  problem: p,
  connection,
  canWrite,
  pending,
  onCheckAgain,
  onResolve,
  now,
}: {
  problem: Problem;
  connection: DirectoryConnection | undefined;
  canWrite: boolean;
  pending: boolean;
  onCheckAgain: (events: readonly DirectoryEvent[]) => Promise<{ closed: number } | undefined>;
  onResolve: (events: readonly DirectoryEvent[]) => void;
  now: number;
}) {
  const { t } = useTranslation("directory");
  const id = useId();
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  // A check from here that passed: until the data shows it, say so in place.
  const [passed, setPassed] = useState(false);
  const latest = p.events[0];
  const firstEvent = p.events[p.events.length - 1];
  if (!latest || !firstEvent) return null;

  const name =
    p.connectionId.startsWith("scim:") || connection?.type === "scim"
      ? t("connections.kinds.scim")
      : (connection?.name ?? t("sync.removed"));
  const count = p.events.length;
  const server = connection?.serverUrl ?? t("errors.problem.itsAddress");
  // The connection's health is its latest run, past 24 hours "unknown" (the server's).
  const healthy = p.cause === "unreachable" && connection?.health === "healthy";
  const fixed = p.cause === "unreachable" && (passed || healthy);
  const link = fixLink(p.cause, p.connectionId);
  const Icon = p.critical ? CircleXIcon : TriangleAlertIcon;

  const affects = (() => {
    if (p.cause === "unreachable") {
      if (!connection) return "";
      if (connection.status === "active") return t("errors.problem.ldapActive");
      if (connection.status === "draft") return t("errors.problem.ldapDraft");
      return t("errors.problem.ldapOff");
    }
    if (p.cause === "signInRefused") return "";
    const r = reach(p.events);
    const parts = [
      r.people ? t("errors.problem.reachPeople", { count: r.people, n: n(r.people) }) : "",
      r.unnamed ? t("errors.problem.reachNew", { count: r.unnamed, n: n(r.unnamed) }) : "",
      r.groups ? t("errors.problem.reachGroups", { count: r.groups, n: n(r.groups) }) : "",
    ].filter(Boolean);
    return parts.length ? t("errors.problem.reach", { what: parts.join(", ") }) : "";
  })();

  async function checkAgain() {
    const result = await onCheckAgain(p.retryable.slice(0, 1));
    if (result?.closed) setPassed(true);
  }

  return (
    <li className={p.critical ? "sync-problem is-critical" : "sync-problem"} aria-labelledby={id}>
      <div className="sync-problem-head">
        <span className="sync-problem-icon" aria-hidden="true">
          <Icon size={16} />
        </span>
        <div className="sync-problem-text">
          <p className="sync-problem-title">
            <strong id={id}>
              {t(`errors.causes.${p.cause}.title`, { count, n: n(count), name })}
            </strong>
            <Badge
              tone={p.critical ? "danger" : "warning"}
              variant={p.critical ? "solid" : "subtle"}
              size="sm"
            >
              {t(`sync.severities.${p.critical ? "critical" : "warning"}`)}
            </Badge>
          </p>
          <p className="sync-problem-line">
            {t("errors.problem.times", {
              count,
              n: n(count),
              first: formatDate(firstEvent.started_at, locale, { dateStyle: "medium" }),
              last: whenText(latest.started_at, now),
            })}{" "}
            {affects}
          </p>
        </div>
      </div>
      <div className="sync-fix">
        <div className="sync-fix-text">
          <Heading level={3} size="title-sm">
            {t("errors.problem.fixTitle")}
          </Heading>
          {fixed ? (
            <Alert
              tone="success"
              icon={CircleCheckIcon}
              title={passed ? t("errors.problem.passed") : t("errors.problem.healthy")}
            />
          ) : null}
          <FixSteps cause={p.cause} server={server} port={portOf(connection?.serverUrl ?? null)} />
          <TechnicalLine event={latest} />
        </div>
        <div className="sync-fix-actions">
          {link && !fixed ? (
            <Button
              variant={p.cause === "unreachable" && canWrite ? "solid" : "ghost"}
              icon={p.cause === "unreachable" && canWrite ? PencilIcon : undefined}
              render={<Link to={link.to} search={link.search} />}
            >
              {p.cause === "unreachable" && canWrite
                ? t("errors.links.editConnection")
                : p.cause === "denied"
                  ? t("errors.links.openScim")
                  : p.cause === "refusedData"
                    ? t("errors.links.checkMappings")
                    : t("errors.links.openConnection")}
            </Button>
          ) : null}
          {canWrite && p.retryable.length && !fixed ? (
            <Button
              variant="soft"
              icon={RefreshCwIcon}
              loading={pending}
              onClick={() => void checkAgain()}
            >
              {t("errors.problem.checkAgain")}
            </Button>
          ) : null}
          {canWrite ? (
            <Button
              variant={fixed ? "solid" : "ghost"}
              disabled={pending}
              onClick={() => onResolve(p.events)}
            >
              {t("errors.problem.markResolved")}
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
