import { Badge, Link, Table } from "@qeetrix/react";
import { Link as RouterLink } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import type { DecisionRecord } from "@/modules/authorization/api/simulate";
import {
  explainDecision,
  explainedMessage,
} from "@/modules/authorization/components/explain/decision-reason";
import { usePeople } from "@/modules/authorization/components/shared/use-people";
import {
  Answer,
  GrantPaths,
  Hops,
} from "@/modules/authorization/components/workspace/decision-parts";
import { Section, When } from "@/modules/authorization/components/workspace/workspace";
import {
  askedOf,
  attributesOf,
  decidingModelOf,
  decidingPolicyOf,
  grantPathsOf,
  MODE_OF,
  relationPathOf,
  subjectIdOf,
} from "./testing-model";

/** Who a decision was about: their name, else a user ID, else the attributes asked with. */
export function useWho() {
  const { t } = useTranslation("authorization");
  const people = usePeople();
  return (record: DecisionRecord) => {
    const id = subjectIdOf(record);
    if (id) return people.name(id) ?? id;
    return attributesOf(record) || t("testing.noSubject");
  };
}

/** The decision: the answer and why, then the paths or the policy behind it. */
export function DecisionView({ record }: { record: DecisionRecord }) {
  const { t } = useTranslation("authorization");
  const who = useWho()(record);
  const mode = MODE_OF[record.engine];
  const reason = explainDecision(record);
  const model = decidingModelOf(record);
  const paths = grantPathsOf(record);
  const hops = relationPathOf(record);
  const policy = decidingPolicyOf(record);
  const asked = askedOf(record);
  return (
    <div className="tst-decision">
      <Answer
        allowed={record.allowed}
        question={t(`testing.question.${mode}`, {
          who,
          asked,
          permission: String(record.input.permission ?? ""),
          relation: String(record.input.relation ?? ""),
          object: String(record.input.object ?? ""),
        })}
        reason={reason ? explainedMessage(reason) : t("answer.noReason")}
        meta={
          model
            ? t("answer.meta", { engine: model, ms: record.durationMs })
            : t("answer.ms", { ms: record.durationMs })
        }
      />
      {paths.length ? (
        <Section label={t("testing.grantPaths", { count: paths.length })} className="ws-flush">
          <GrantPaths paths={paths} />
          <p className="ws-note">{t("testing.grantPathsHint")}</p>
        </Section>
      ) : null}
      {hops.length ? (
        <Section label={t("testing.relationshipPath")} className="ws-flush">
          <Hops path={hops} />
        </Section>
      ) : null}
      {policy ? (
        <Section label={t("testing.decidedBy")} className="ws-flush">
          <p className="ws-note">
            <Link
              href={`/authorization/abac?policy=${policy.id}`}
              render={<RouterLink to="/authorization/abac" search={{ policy: policy.id }} />}
            >
              {policy.name ?? t("testing.thePolicy")}
            </Link>
          </p>
        </Section>
      ) : null}
    </div>
  );
}

/** This tab's decisions, newest first: from here, and from ABAC's tests. */
export function HistoryList({
  history,
  current,
  onOpen,
}: {
  history: readonly DecisionRecord[];
  current: string | null;
  onOpen: (record: DecisionRecord) => void;
}) {
  const { t } = useTranslation("authorization");
  const who = useWho();
  const now = Date.now();
  if (history.length === 0) return <p className="ws-note ws-pad">{t("testing.historyEmpty")}</p>;
  return (
    <ul className="ws-list">
      {history.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            className="ws-row"
            aria-current={r.id === current ? "true" : undefined}
            onClick={() => onOpen(r)}
          >
            <span className="ws-row-text">
              <strong>{who(r)}</strong>
              <small>
                <code className="ws-code">{askedOf(r)}</code>
              </small>
              <small>
                {t(`testing.modes.${MODE_OF[r.engine]}`)} · <When at={r.at} now={now} />
              </small>
            </span>
            <Badge tone={r.allowed ? "success" : "danger"} size="sm">
              {r.allowed ? t("answer.allowed") : t("answer.denied")}
            </Badge>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** One request, checked for many people: each person's answer and why. */
export function BatchTable({
  results,
  asked,
}: {
  results: readonly DecisionRecord[];
  asked: string;
}) {
  const { t } = useTranslation("authorization");
  const who = useWho();
  return (
    <Table<DecisionRecord>
      label={t("testing.batchLabel", { asked })}
      rows={results}
      rowId={(r) => r.id}
      rowLabel={(r) => who(r)}
      empty={<p className="ws-note">{t("testing.batchEmpty")}</p>}
      columns={[
        { id: "who", header: t("testing.person"), primary: true, cell: (r) => who(r) },
        {
          id: "decision",
          header: t("testing.decision"),
          width: 112,
          cell: (r) =>
            r.failed ? (
              <Badge size="sm">{t("testing.failed")}</Badge>
            ) : (
              <Badge tone={r.allowed ? "success" : "danger"} size="sm">
                {r.allowed ? t("answer.allowed") : t("answer.denied")}
              </Badge>
            ),
        },
        {
          id: "why",
          header: t("testing.why"),
          cell: (r) => {
            if (r.failed) return t("testing.failedHint");
            const reason = explainDecision(r);
            return reason ? explainedMessage(reason) : "";
          },
        },
        {
          id: "ms",
          header: t("testing.time"),
          width: 88,
          numeric: true,
          cell: (r) => (r.failed ? "—" : t("answer.ms", { ms: r.durationMs })),
        },
      ]}
    />
  );
}
