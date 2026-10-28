// A run's checks, filtered by result, with the run as a download; and every run, each opening its
// checks on this page (the address keeps which).

import { DownloadIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  formatDate,
  formatNumber,
  MenuItem,
  ScrollArea,
  Table,
  Toggle,
  ToggleGroup,
} from "@qeetrix/react";
import { Pagination } from "@qeetrix/react/experimental";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import {
  type ControlResult,
  type ControlStatus,
  type EvidenceRun,
  evidenceRunQuery,
  type Framework,
} from "@/modules/compliance/api/evidence";
import type { Person } from "@/modules/compliance/use-people";
import { useTenantId } from "@/platform/auth/session";
import { exportToJson } from "@/shared/utils/data-export";
import { Code, ControlBadge, Section, When } from "../compliance-parts";

const MONTH = 30 * 86_400_000;
const PAGE = 10;

/** Saves a run, its checks included, as the JSON an auditor can be given. */
function download(framework: Framework, run: EvidenceRun) {
  exportToJson(`evidence-${framework}-${run.generated_at.slice(0, 10)}`, [run]);
}

export function ControlsSection({ framework, run }: { framework: Framework; run: EvidenceRun }) {
  const { t } = useTranslation("compliance");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const [show, setShow] = useState<"all" | ControlStatus>("all");
  const controls = run.controls ?? [];
  const rows = show === "all" ? controls : controls.filter((c) => c.status === show);
  const count = (s: ControlStatus) => controls.filter((c) => c.status === s).length;
  const label = t("evidence.controls.label", { framework: t(`frameworks.${framework}.name`) });

  return (
    <Section
      title={t("evidence.controls.title")}
      description={t("evidence.controls.description", {
        count: controls.length,
        n: n(controls.length),
        date: formatDate(run.generated_at, locale),
      })}
      action={
        <Button variant="soft" icon={DownloadIcon} onClick={() => download(framework, run)}>
          {t("evidence.download")}
        </Button>
      }
    >
      <ScrollArea orientation="horizontal" className="cmp-wide" aria-label={label}>
        <Table<ControlResult>
          label={label}
          rows={rows}
          rowId={(c) => c.id}
          rowLabel={(c) => c.name}
          toolbar={
            <ToggleGroup
              aria-label={t("evidence.controls.show")}
              size="sm"
              value={[show]}
              onValueChange={(v) => v[0] && setShow(v[0] as typeof show)}
            >
              <Toggle value="all">
                {t("evidence.controls.all")}
                <span className="cmp-count">{n(controls.length)}</span>
              </Toggle>
              {(["fail", "pass", "na"] as const)
                .filter((s) => s !== "na" || count("na") > 0)
                .map((s) => (
                  <Toggle key={s} value={s}>
                    {t(`evidence.status.${s}`)}
                    <span className="cmp-count">{n(count(s))}</span>
                  </Toggle>
                ))}
            </ToggleGroup>
          }
          columns={[
            {
              id: "criteria",
              header: t("evidence.controls.criteria"),
              width: 104,
              cell: (c) => <Code>{c.criteria}</Code>,
            },
            {
              id: "control",
              header: t("evidence.controls.control"),
              primary: true,
              width: "30%",
              cell: (c) => (
                <span className="cmp-cell">
                  <strong>{c.name}</strong>
                  <small>{c.category}</small>
                </span>
              ),
            },
            {
              id: "status",
              header: t("evidence.controls.status"),
              width: 136,
              cell: (c) => <ControlBadge status={c.status} />,
            },
            {
              id: "evidence",
              header: t("evidence.controls.evidence"),
              cell: (c) => <span className="cmp-evidence">{c.detail}</span>,
            },
          ]}
        />
      </ScrollArea>
    </Section>
  );
}

export function RunsSection({
  framework,
  runs,
  index,
  now,
  names,
  named,
  onRunChange,
}: {
  framework: Framework;
  runs: readonly EvidenceRun[];
  index: number;
  now: number;
  names: ReadonlyMap<string, Person>;
  /** The names can be read (user.read). */
  named: boolean;
  onRunChange: (runId: string | undefined) => void;
}) {
  const { t } = useTranslation("compliance");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const tenantId = useTenantId();
  const qc = useQueryClient();
  const [offset, setOffset] = useState(Math.floor(index / PAGE) * PAGE);
  const label = t("evidence.runs.label", { framework: t(`frameworks.${framework}.name`) });
  const first = runs.at(-1);
  const open = (run: EvidenceRun) => onRunChange(run.id === runs[0]?.id ? undefined : run.id);
  const downloadRun = async (run: EvidenceRun) =>
    download(framework, await qc.fetchQuery(evidenceRunQuery(tenantId, run.id)));
  const by = (run: EvidenceRun) =>
    !run.generated_by
      ? t("evidence.facts.byQeetId")
      : !named
        ? t("evidence.facts.byMember")
        : (names.get(run.generated_by)?.name ?? t("evidence.facts.byFormer"));

  return (
    <Section
      title={t("evidence.runs.title")}
      status={<Badge size="sm">{n(runs.length)}</Badge>}
      description={
        first
          ? t(
              runs.length >= 100 ? "evidence.runs.descriptionCapped" : "evidence.runs.description",
              {
                date: formatDate(first.generated_at, locale),
              },
            )
          : undefined
      }
    >
      <ScrollArea orientation="horizontal" className="cmp-wide" aria-label={label}>
        <Table<EvidenceRun>
          label={label}
          rows={runs.slice(offset, offset + PAGE)}
          rowId={(r) => r.id}
          rowLabel={(r) =>
            t("evidence.runs.rowLabel", { date: formatDate(r.generated_at, locale) })
          }
          onRowClick={open}
          rowActions={(r) => (
            <>
              <MenuItem onClick={() => open(r)}>{t("evidence.runs.view")}</MenuItem>
              <MenuItem icon={DownloadIcon} onClick={() => void downloadRun(r)}>
                {t("evidence.download")}
              </MenuItem>
            </>
          )}
          columns={[
            {
              id: "at",
              header: t("evidence.runs.generated"),
              primary: true,
              cell: (r) => (
                <span className="cmp-run">
                  <span className="cmp-cell">
                    <strong>{formatDate(r.generated_at, locale)}</strong>
                    {now - new Date(r.generated_at).getTime() <= MONTH ? (
                      <small>
                        <When iso={r.generated_at} now={now} />
                      </small>
                    ) : null}
                  </span>
                  {r.id === runs[index]?.id ? (
                    <Badge tone="brand" size="sm">
                      {t("evidence.runs.viewing")}
                    </Badge>
                  ) : null}
                </span>
              ),
            },
            { id: "by", header: t("evidence.runs.by"), cell: by },
            {
              id: "pass",
              header: t("evidence.status.pass"),
              numeric: true,
              width: 96,
              cell: (r) => n(r.pass_count),
            },
            {
              id: "fail",
              header: t("evidence.status.fail"),
              numeric: true,
              width: 96,
              cell: (r) => n(r.fail_count),
            },
            {
              id: "na",
              header: t("evidence.status.na"),
              numeric: true,
              width: 128,
              cell: (r) => n(r.na_count),
            },
          ]}
        />
      </ScrollArea>
      {runs.length > PAGE ? (
        <Pagination
          className="cmp-pager"
          offset={offset}
          pageSize={PAGE}
          total={runs.length}
          onOffsetChange={setOffset}
          locale={locale}
        />
      ) : null}
    </Section>
  );
}
