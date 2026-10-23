import { useTranslation } from "react-i18next";
import {
  Badge,
  JSONTree,
  Timeline,
  TimelineContent,
  TimelineIndicator,
  TimelineItem,
  TimelineTitle,
} from "@qeetrix/ui";
import { ArrowRightIcon, ClockIcon, GaugeIcon } from "@qeetrix/icons";

import { formatLocale } from "@/i18n";
import type { AbacDecision } from "@/modules/authorization/api/abac";
import type {
  DecisionRecord,
  RbacExplainPath,
  RebacPathStep,
} from "@/modules/authorization/api/simulate";
import { DecisionBadge, ENGINE_DESCRIPTIONS, ENGINE_LABELS } from "../shared/decision-badge";
import { explainDecision, explainedMessage, explainTraceStep } from "./decision-reason";

/**
 * Renders one decision in full: outcome, engine, latency, the engine's grant paths or trace, and
 * the raw request.
 */
export function DecisionExplain({ record }: { record: DecisionRecord }) {
  const { t, i18n } = useTranslation("authorization");
  // Worded from the server's reason code (or a sentence it knows), never its text.
  const reason = explainDecision(record);
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-3">
        <DecisionBadge allowed={record.allowed} />
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px] uppercase">
            {ENGINE_LABELS[record.engine]}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {i18n.t(ENGINE_DESCRIPTIONS[record.engine])}
          </span>
        </div>
        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <GaugeIcon className="size-3.5" aria-hidden />
          {t("simulator.batch.ms", { count: record.durationMs })}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <ClockIcon className="size-3.5" aria-hidden />
          {new Date(record.at).toLocaleTimeString(formatLocale())}
        </span>
      </header>

      {reason && (
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {explainedMessage(reason)}
        </p>
      )}

      {record.engine === "rbac" && record.rbac && <RbacExplainView paths={record.rbac.paths} />}
      {record.engine === "abac" && record.abac && (
        <AbacTraceView
          trace={record.abac.trace ?? []}
          matched={record.abac.matched_policy_id}
          effect={record.abac.effect}
        />
      )}
      {record.engine === "rebac" && record.rebac && (
        <RebacPathView path={record.rebac.path ?? []} />
      )}
      {record.engine === "authzen" && record.authzen && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">{t("decisionExplain.decisionContext")}</h3>
          <div className="rounded-md border bg-muted/20 p-3">
            <JSONTree
              value={record.authzen.context ?? { decision: record.authzen.decision }}
              initialOpenDepth={2}
            />
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-medium">{t("decisionExplain.request")}</h3>
        <div className="rounded-md border bg-muted/20 p-3">
          <JSONTree value={record.input} initialOpenDepth={2} rootLabel="input" />
        </div>
      </section>
    </div>
  );
}

function RbacExplainView({ paths }: { paths: RbacExplainPath[] }) {
  const { t } = useTranslation("authorization");
  if (paths.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("decisionExplain.noGrantPathAccess")}</p>
    );
  }
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">{t("decisionExplain.grantPaths")}</h3>
      <ul className="flex flex-col gap-2">
        {paths.map((p) => {
          const isGroup = p.via.startsWith("group:");
          return (
            <li
              // The server returns one path per role and grant source, so this key is unique.
              key={`${p.role_id}-${p.group_id ?? p.via}`}
              className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 p-3"
            >
              <Badge variant="default" className="font-mono">
                {p.permission}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {t("decisionExplain.grantedBy")}
              </span>
              <Badge variant="secondary">{p.granted_by}</Badge>
              <Badge variant={isGroup ? "outline" : "muted"}>
                {isGroup
                  ? t("check.viaGroup", { group: p.via.slice("group:".length) })
                  : t("check.directAssignment")}
              </Badge>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                {t("check.roleShort", { id: p.role_id.slice(0, 8) })}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AbacTraceView({
  trace,
  matched,
  effect,
}: {
  trace: string[];
  matched?: string | null;
  effect: AbacDecision["effect"];
}) {
  const { t } = useTranslation("authorization");
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">{t("decisionExplain.evaluationTrace")}</h3>
        {effect && (
          <Badge variant={effect === "deny" ? "destructive" : "success"}>
            {t(`abac.editor.${effect}`)}
          </Badge>
        )}
        {matched && (
          <span className="font-mono text-[10px] text-muted-foreground">
            {t("decisionExplain.matchedPolicy", { id: matched.slice(0, 8) })}
          </span>
        )}
      </div>
      {trace.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("decisionExplain.noPolicyMatchedDefaultDeny")}
        </p>
      ) : (
        <Timeline>
          {trace.map((step, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: steps can repeat; the order is fixed
            <TimelineItem key={i}>
              <TimelineIndicator>
                <span className="flex size-5 items-center justify-center rounded-full border bg-background text-[10px] font-medium">
                  {i + 1}
                </span>
              </TimelineIndicator>
              <TimelineContent>
                <TimelineTitle className="font-mono text-xs">
                  {explainedMessage(explainTraceStep(step))}
                </TimelineTitle>
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      )}
    </section>
  );
}

function RebacPathView({ path }: { path: RebacPathStep[] }) {
  const { t } = useTranslation("authorization");
  if (path.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("decisionExplain.noRelationshipPathResolves")}
      </p>
    );
  }
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">{t("decisionExplain.relationshipPath")}</h3>
      <ol className="flex flex-col gap-1">
        {path.map((step) => (
          // A resolved path has one hop per depth, so this key is unique.
          <li
            key={`${step.depth}:${step.object}#${step.relation}`}
            className="flex items-center gap-2 font-mono text-xs"
          >
            <Badge variant="muted" className="text-[10px]">
              {t("decisionExplain.hop", { depth: step.depth })}
            </Badge>
            <span>{step.object}</span>
            <span className="text-muted-foreground">#{step.relation}</span>
            <ArrowRightIcon className="size-3 text-muted-foreground" aria-hidden />
            <span>{step.subject}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
