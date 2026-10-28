// Compliance › GDPR: right-to-erasure requests. Each waits 30 days, can be withdrawn until then,
// and is then carried out by a sweeper that ends the person's sessions, redacts their personal data
// in place and deletes their password and authenticator; their audit events are kept.

import { EraserIcon, PlusIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  formatDate,
  formatNumber,
  formatRelativeTime,
  MenuItem,
  ScrollArea,
  Table,
} from "@qeetrix/react";
import {
  AvatarItem,
  DataState,
  DescriptionItem,
  DescriptionList,
  EmptyState,
} from "@qeetrix/react/experimental";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { useEvidenceRun, useEvidenceRuns } from "@/modules/compliance/api/evidence";
import {
  ERASURE_GRACE_DAYS,
  type PurgeRequest,
  useCancelGdprPurge,
  useGdprPurges,
} from "@/modules/compliance/api/gdpr";
import { statusIn } from "@/modules/compliance/evidence-model";
import { isErased, PURGE_LOOK, pendingOf } from "@/modules/compliance/gdpr-model";
import { type Person, usePeople } from "@/modules/compliance/use-people";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { CompliancePage } from "../compliance-page";
import { Code, ControlBadge, Fact, Facts, Section, When } from "../compliance-parts";
import { ErasureDrawer } from "./erasure-drawer";

const NONE: PurgeRequest[] = [];
const MONTH = 30 * 86_400_000;
const shortId = (id: string) => `${id.slice(0, 8)}…`;

export function GdprPage() {
  const { t } = useTranslation("compliance");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const access = useCapabilities();
  const canAudit = access.can("audit.read");
  const list = useGdprPurges();
  const people = usePeople();
  const cancel = useCancelGdprPurge();
  const runSensitive = useSensitiveAction();
  const [filing, setFiling] = useState(false);
  const [now] = useState(() => Date.now());
  const iso = useEvidenceRuns("iso27001", canAudit);
  const isoRun = useEvidenceRun(iso.data?.items[0]?.id ?? null).data;

  const requests = list.data?.items ?? NONE;
  const pending = pendingOf(requests);
  const pendingIds = useMemo(() => new Set(pendingOf(requests).map((r) => r.user_id)), [requests]);
  const next = pending[0];
  const newest = requests[0];
  const who = (id?: string | null) => (id ? people.byId.get(id) : undefined);
  const nameOf = (id?: string | null) => {
    const person = who(id);
    if (person) return isErased(person.email) ? t("gdpr.list.erasedPerson") : person.name;
    return id ? shortId(id) : t("gdpr.list.someone");
  };

  const withdraw = (r: PurgeRequest) => {
    const name = nameOf(r.user_id);
    runSensitive({
      confirm: {
        title: t("gdpr.withdraw.title", { name }),
        description: t("gdpr.withdraw.description", {
          name,
          date: formatDate(r.grace_until, locale, { dateStyle: "long" }),
          days: ERASURE_GRACE_DAYS,
        }),
        confirmLabel: t("gdpr.withdraw.confirm"),
        tone: "default",
      },
      actionLabel: t("gdpr.withdraw.action"),
      run: () => cancel.mutateAsync(r.id),
    }).catch(settleSensitiveAction);
  };

  return (
    <CompliancePage
      actions={
        <Button icon={PlusIcon} onClick={() => setFiling(true)}>
          {t("gdpr.fileRequest")}
        </Button>
      }
    >
      <Facts note={t("gdpr.note", { days: ERASURE_GRACE_DAYS })}>
        <DescriptionList layout="columns" columns={canAudit ? 4 : 3}>
          <DescriptionItem term={t("gdpr.facts.requests")}>
            <Fact
              value={
                list.data ? (
                  pending.length ? (
                    <Badge tone="warning">
                      {t("gdpr.facts.pending", { count: pending.length, n: n(pending.length) })}
                    </Badge>
                  ) : (
                    <Badge>{t("gdpr.facts.nonePending")}</Badge>
                  )
                ) : (
                  "—"
                )
              }
              sub={
                list.data
                  ? t("gdpr.facts.onRecord", { count: requests.length, n: n(requests.length) })
                  : undefined
              }
            />
          </DescriptionItem>
          <DescriptionItem term={t("gdpr.facts.next")}>
            {next ? (
              <Fact
                value={<When iso={next.grace_until} now={now} />}
                sub={t("gdpr.facts.nextOn", {
                  date: formatDate(next.grace_until, locale),
                  name: nameOf(next.user_id),
                })}
              />
            ) : (
              <Fact value={t("gdpr.facts.noneScheduled")} />
            )}
          </DescriptionItem>
          <DescriptionItem term={t("gdpr.facts.grace")}>
            <Fact
              value={t("gdpr.facts.days", { count: ERASURE_GRACE_DAYS })}
              sub={t("gdpr.facts.setByQeetId")}
            />
          </DescriptionItem>
          {canAudit ? (
            <DescriptionItem term={t("gdpr.facts.check")}>
              {isoRun ? (
                <Fact
                  value={
                    <>
                      <Code>A.18.1</Code>
                      {statusIn(isoRun, "A.18.1-GDPR") ? (
                        <ControlBadge status={statusIn(isoRun, "A.18.1-GDPR") ?? "na"} />
                      ) : null}
                    </>
                  }
                  sub={t(
                    newest && Date.parse(newest.created_at) > Date.parse(isoRun.generated_at)
                      ? "gdpr.facts.checkBefore"
                      : "gdpr.facts.checkRun",
                    { date: formatDate(isoRun.generated_at, locale) },
                  )}
                />
              ) : (
                <Fact
                  value={<Code>A.18.1</Code>}
                  sub={iso.data ? t("gdpr.facts.checkNoRun") : undefined}
                />
              )}
            </DescriptionItem>
          ) : null}
        </DescriptionList>
      </Facts>

      <Section
        title={t("gdpr.list.title")}
        status={list.data ? <Badge size="sm">{n(requests.length)}</Badge> : undefined}
        description={t("gdpr.list.description")}
      >
        <DataState loading={list.isLoading} error={list.error} onRetry={() => void list.refetch()}>
          <ScrollArea
            orientation="horizontal"
            className="cmp-wide"
            aria-label={t("gdpr.list.title")}
          >
            <Table<PurgeRequest>
              label={t("gdpr.list.title")}
              rows={requests}
              rowId={(r) => r.id}
              rowLabel={(r) => nameOf(r.user_id)}
              rowActions={(r) =>
                r.status === "pending" ? (
                  <MenuItem onClick={() => withdraw(r)}>{t("gdpr.withdraw.menu")}</MenuItem>
                ) : null
              }
              empty={
                <EmptyState
                  size="section"
                  icon={EraserIcon}
                  title={t("gdpr.list.emptyTitle")}
                  description={t("gdpr.list.emptyDescription", { days: ERASURE_GRACE_DAYS })}
                />
              }
              columns={[
                {
                  id: "person",
                  header: t("gdpr.list.person"),
                  primary: true,
                  width: "24%",
                  cell: (r) => <PersonCell person={who(r.user_id)} id={r.user_id} />,
                },
                {
                  id: "reason",
                  header: t("gdpr.list.reason"),
                  cell: (r) => (
                    <span className="cmp-evidence">
                      {r.reason?.trim() || t("gdpr.list.noReason")}
                    </span>
                  ),
                },
                {
                  id: "status",
                  header: t("gdpr.list.status"),
                  width: 120,
                  cell: (r) => (
                    <Badge tone={PURGE_LOOK[r.status]} size="sm">
                      {t(`gdpr.status.${r.status}`)}
                    </Badge>
                  ),
                },
                {
                  id: "erasure",
                  header: t("gdpr.list.erasure"),
                  width: 168,
                  cell: (r) => <ErasureCell request={r} now={now} />,
                },
                {
                  id: "filed",
                  header: t("gdpr.list.filed"),
                  width: 176,
                  cell: (r) => (
                    <span className="cmp-cell">
                      <span>{formatDate(r.created_at, locale)}</span>
                      {r.requested_by ? (
                        <small>{t("gdpr.list.filedBy", { name: nameOf(r.requested_by) })}</small>
                      ) : null}
                    </span>
                  ),
                },
              ]}
            />
          </ScrollArea>
        </DataState>
      </Section>

      <ErasureDrawer open={filing} onOpenChange={setFiling} people={people} pending={pendingIds} />
    </CompliancePage>
  );
}

function PersonCell({ person, id }: { person?: Person; id: string }) {
  const { t } = useTranslation("compliance");
  if (!person) return <Code>{shortId(id)}</Code>;
  if (isErased(person.email))
    return (
      <span className="cmp-cell">
        <strong>{t("gdpr.list.erasedPerson")}</strong>
        <small>
          <Code>{shortId(id)}</Code>
        </small>
      </span>
    );
  return <AvatarItem name={person.name} description={person.email} size="sm" />;
}

function ErasureCell({ request: r, now }: { request: PurgeRequest; now: number }) {
  const { t } = useTranslation("compliance");
  const locale = formatLocale();
  if (r.status === "cancelled")
    return <span className="cmp-evidence">{t("gdpr.list.notErased")}</span>;
  if (r.status === "quarantined")
    return <span className="cmp-evidence">{t("gdpr.list.quarantined")}</span>;
  const at = r.status === "completed" ? (r.completed_at ?? r.grace_until) : r.grace_until;
  // A waiting request is at most 30 days out, so "in 2 weeks" always helps; a done one, for a month.
  const near = r.status === "pending" || Math.abs(Date.parse(at) - now) <= MONTH;
  return (
    <span className="cmp-cell">
      <span>{formatDate(at, locale)}</span>
      {near ? <small>{formatRelativeTime(Date.parse(at), locale, now)}</small> : null}
    </span>
  );
}
