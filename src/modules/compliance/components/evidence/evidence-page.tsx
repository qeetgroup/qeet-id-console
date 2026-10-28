// SOC 2 and ISO 27001: one view. A run checks this organisation's Qeet ID settings and audit log
// against the framework and is kept as it was, so the view opens on the newest run: its result,
// what's missing (and since when), every check, then every run, each of which opens here.
// Readiness evidence only: the server records no audit, report or certificate.

import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
} from "@qeetrix/icons";
import { Badge, Button, formatDate, formatDateTime, formatNumber } from "@qeetrix/react";
import {
  DataState,
  DescriptionItem,
  DescriptionList,
  EmptyState,
} from "@qeetrix/react/experimental";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import {
  type EvidenceRun,
  type Framework,
  useEvidenceRunDetails,
  useEvidenceRuns,
  useGenerateEvidence,
} from "@/modules/compliance/api/evidence";
import { HISTORY_RUNS } from "@/modules/compliance/evidence-model";
import { type Person, usePeople } from "@/modules/compliance/use-people";
import { useCapabilities } from "@/platform/security/capability-provider";
import { CompliancePage } from "../compliance-page";
import { Fact, Facts, When } from "../compliance-parts";
import { MissingSection } from "./evidence-missing";
import { ControlsSection, RunsSection } from "./evidence-tables";

export type EvidencePageProps = {
  framework: Framework;
  /** The run on show; none for the newest. */
  runId?: string;
  onRunChange: (runId: string | undefined) => void;
};

export function EvidencePage({ framework, runId, onRunChange }: EvidencePageProps) {
  const { t } = useTranslation("compliance");
  const access = useCapabilities();
  const canGenerate = access.can("audit.write");
  const list = useEvidenceRuns(framework);
  const generate = useGenerateEvidence(framework);
  const runs = list.data?.items ?? [];
  const found = runId ? runs.findIndex((r) => r.id === runId) : 0;
  const index = Math.max(found, 0);

  const generateButton = canGenerate ? (
    <Button
      icon={RefreshCwIcon}
      loading={generate.isPending}
      onClick={() => generate.mutate(undefined, { onSuccess: () => onRunChange(undefined) })}
    >
      {t("evidence.generate")}
    </Button>
  ) : undefined;

  return (
    <CompliancePage actions={runs.length ? generateButton : undefined}>
      <DataState
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        empty={!list.isLoading && runs.length === 0}
        emptyState={
          <EmptyState
            icon={ShieldCheckIcon}
            title={t(`frameworks.${framework}.emptyTitle`)}
            description={t(`frameworks.${framework}.emptyDescription`)}
            actions={generateButton}
          />
        }
      >
        {runs.length ? (
          <RunView
            key={`${framework}-${runs[index]?.id}`}
            framework={framework}
            runs={runs}
            index={index}
            missingRun={!!runId && found < 0}
            onRunChange={onRunChange}
          />
        ) : null}
      </DataState>
    </CompliancePage>
  );
}

function RunView({
  framework,
  runs,
  index,
  missingRun,
  onRunChange,
}: {
  framework: Framework;
  runs: readonly EvidenceRun[];
  index: number;
  missingRun: boolean;
  onRunChange: (runId: string | undefined) => void;
}) {
  const { t } = useTranslation("compliance");
  const locale = formatLocale();
  const people = usePeople();
  const now = useMemo(() => Date.now(), []);
  // This run and the ones before it, for the "since" lines, and the newest, to compare with.
  const ids = useMemo(() => {
    const back = runs.slice(index, index + HISTORY_RUNS).map((r) => r.id);
    const latest = runs[0]?.id;
    return latest && !back.includes(latest) ? [...back, latest] : back;
  }, [runs, index]);
  const details = useEvidenceRunDetails(ids);
  const history = details.runs.slice(0, Math.min(HISTORY_RUNS, runs.length - index));
  const run = history[0];
  const latestRun = index === 0 ? run : details.runs.at(-1);
  const summary = runs[index];
  if (!summary) return null;
  const latest = index === 0;
  const total = summary.pass_count + summary.fail_count + summary.na_count;
  const n = (value: number) => formatNumber(value, locale);

  return (
    <>
      <Facts note={t(`frameworks.${framework}.note`)}>
        {missingRun ? (
          <p className="cmp-viewing">
            <InfoIcon aria-hidden="true" />
            <span>{t("evidence.runMissing")}</span>
          </p>
        ) : null}
        {!latest && runs[0] ? (
          <p className="cmp-viewing">
            <InfoIcon aria-hidden="true" />
            <span>
              {t("evidence.viewingOlder", {
                date: formatDate(summary.generated_at, locale),
                latest: formatDate(runs[0].generated_at, locale),
              })}
            </span>
            <Button variant="ghost" size="sm" onClick={() => onRunChange(undefined)}>
              {t("evidence.showLatest")}
            </Button>
          </p>
        ) : null}
        <DescriptionList layout="columns" columns={4}>
          <DescriptionItem term={t("evidence.facts.result")}>
            <Fact
              value={
                summary.fail_count > 0 ? (
                  <Badge tone="danger" icon={CircleAlertIcon}>
                    {t("evidence.facts.failing", {
                      count: summary.fail_count,
                      n: n(summary.fail_count),
                    })}
                  </Badge>
                ) : (
                  <Badge tone="success" icon={CircleCheckIcon}>
                    {t("evidence.facts.noneFailing")}
                  </Badge>
                )
              }
              sub={
                summary.na_count
                  ? t("evidence.facts.passOfWithNa", {
                      pass: n(summary.pass_count),
                      total: n(total),
                      na: n(summary.na_count),
                    })
                  : t("evidence.facts.passOf", { pass: n(summary.pass_count), total: n(total) })
              }
            />
          </DescriptionItem>
          <DescriptionItem
            term={latest ? t("evidence.facts.lastRun") : t("evidence.facts.thisRun")}
          >
            <Fact
              value={<When iso={summary.generated_at} now={now} />}
              sub={formatDateTime(summary.generated_at, locale)}
            />
          </DescriptionItem>
          <DescriptionItem term={t("evidence.facts.runBy")}>
            <RunBy
              id={summary.generated_by}
              person={people.byId.get(summary.generated_by ?? "")}
              named={people.canRead}
            />
          </DescriptionItem>
          <DescriptionItem term={t("evidence.facts.scope")}>
            <Fact
              value={t("evidence.facts.checks", { count: total, n: n(total) })}
              sub={t(`frameworks.${framework}.scope`)}
            />
          </DescriptionItem>
        </DescriptionList>
      </Facts>

      <DataState
        loading={!run && details.loading}
        error={run ? null : details.error}
        onRetry={details.retry}
      >
        {run ? (
          <>
            <MissingSection
              run={run}
              history={history}
              total={runs.length - index}
              latest={latest}
              latestRun={latestRun}
            />
            <ControlsSection framework={framework} run={run} />
          </>
        ) : null}
      </DataState>

      <RunsSection
        framework={framework}
        runs={runs}
        index={index}
        now={now}
        names={people.byId}
        named={people.canRead}
        onRunChange={onRunChange}
      />
    </>
  );
}

/** Who generated a run: a person, someone no longer in the organisation, or Qeet ID itself. */
function RunBy({ id, person, named }: { id?: string | null; person?: Person; named: boolean }) {
  const { t } = useTranslation("compliance");
  if (!id) return <Fact value={t("evidence.facts.byQeetId")} />;
  if (!named) return <Fact value={t("evidence.facts.byMember")} />;
  if (!person) return <Fact value={t("evidence.facts.byFormer")} />;
  return <Fact value={person.name} sub={person.email} />;
}
