// Compliance › Retention: how long deleted people are kept before they're removed for good (the
// one data class an organisation sets), who that makes due, what the evidence says about it, and
// the data Qeet ID keeps by its own rules. Removal is a hard delete; the audit log keeps its events.

import { EraserIcon, MonitorSmartphoneIcon, ScrollTextIcon, ArrowRightIcon } from "@qeetrix/icons";
import { Badge, Button, formatDate, formatNumber } from "@qeetrix/react";
import { DataState, NumberField } from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { useEvidenceRun, useEvidenceRuns } from "@/modules/compliance/api/evidence";
import { ERASURE_GRACE_DAYS } from "@/modules/compliance/api/gdpr";
import {
  RETENTION_DAYS,
  type RetentionPolicy,
  useRetentionPolicy,
} from "@/modules/compliance/api/retention";
import {
  useRetentionDue,
  useRunRetention,
  useUpdateRetentionPolicy,
} from "@/modules/compliance/api/retention-changes";
import { statusIn } from "@/modules/compliance/evidence-model";
import { dueCount, nextDue } from "@/modules/compliance/retention-model";
import { usePeople } from "@/modules/compliance/use-people";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { CompliancePage } from "../compliance-page";
import { Code, ControlBadge, Detail, EditingDetail, Item, Section } from "../compliance-parts";

/** Directory › Deleted lists at most this many, newest first (users.ListDeleted). */
const DELETED_PAGE = 100;

export function RetentionPage() {
  const policy = useRetentionPolicy();
  return (
    <CompliancePage>
      <DataState
        loading={policy.isLoading}
        error={policy.error}
        onRetry={() => void policy.refetch()}
      >
        {policy.data ? <RetentionView policy={policy.data} /> : null}
      </DataState>
    </CompliancePage>
  );
}

function RetentionView({ policy }: { policy: RetentionPolicy }) {
  const { t } = useTranslation("compliance");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const access = useCapabilities();
  const canWrite = access.can("policy.write");
  const canAudit = access.can("audit.read");
  const people = usePeople();
  const due = useRetentionDue();
  const update = useUpdateRetentionPolicy();
  const run = useRunRetention();
  const runSensitive = useSensitiveAction();
  const [now] = useState(() => Date.now());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<number | null>(policy.deleted_users_days);
  const [draftError, setDraftError] = useState<string>();

  const soc = useEvidenceRuns("soc2", canAudit).data?.items[0];
  const iso = useEvidenceRuns("iso27001", canAudit).data?.items[0];
  const socRun = useEvidenceRun(soc?.id ?? null).data;
  const isoRun = useEvidenceRun(iso?.id ?? null).data;

  const on = policy.deleted_users_enabled;
  const days = policy.deleted_users_days;
  const deleted = people.deleted;
  // The list is complete below a full page; past it, counts from it would be short.
  const counted = people.canRead && deleted.length < DELETED_PAGE;
  const dueNow = due.data?.ripe_deleted_users;
  const next = nextDue(deleted, days, now);

  const save = (body: RetentionPolicy, confirm?: Parameters<typeof runSensitive>[0]["confirm"]) =>
    runSensitive({
      confirm,
      actionLabel: t("retention.saveAction"),
      run: () => update.mutateAsync(body),
    });

  const toggle = () => {
    const body = { deleted_users_enabled: !on, deleted_users_days: days };
    const confirm = on
      ? {
          title: t("retention.turnOff.title"),
          description: t("retention.turnOff.description"),
          confirmLabel: t("retention.turnOff.confirm"),
          tone: "default" as const,
        }
      : {
          title: t("retention.turnOn.title"),
          description: dueNow
            ? t("retention.turnOn.descriptionDue", { count: dueNow, n: n(dueNow), days })
            : t("retention.turnOn.description", { days }),
          confirmLabel: t("retention.turnOn.confirm"),
          tone: "destructive" as const,
        };
    save(body, confirm).catch(settleSensitiveAction);
  };

  const saveDays = () => {
    if (draft === null || draft < RETENTION_DAYS.min || draft > RETENTION_DAYS.max)
      return setDraftError(
        t("retention.keep.range", { min: RETENTION_DAYS.min, max: n(RETENTION_DAYS.max) }),
      );
    if (draft === days) return setEditing(false);
    // A shorter window removes, within the hour, everyone it makes due who wasn't already.
    const more = counted ? dueCount(deleted, draft, now) - dueCount(deleted, days, now) : null;
    const confirm =
      on && draft < days && more !== 0
        ? {
            title: t("retention.shorten.title", { days: draft }),
            description:
              more === null
                ? t("retention.shorten.descriptionUncounted", { days: draft })
                : t("retention.shorten.description", { count: more, n: n(more), days: draft }),
            confirmLabel: t("retention.shorten.confirm"),
            tone: "destructive" as const,
          }
        : undefined;
    save({ deleted_users_enabled: on, deleted_users_days: draft }, confirm)
      .then((saved) => saved && setEditing(false))
      .catch(settleSensitiveAction);
  };

  const removeNow = () => {
    if (!dueNow) return;
    runSensitive({
      confirm: {
        title: t("retention.removeNow.title", { count: dueNow, n: n(dueNow) }),
        description: t("retention.removeNow.description", { count: dueNow, n: n(dueNow), days }),
        confirmLabel: t("retention.removeNow.confirm"),
        tone: "destructive",
      },
      actionLabel: t("retention.removeNow.action"),
      run: () => run.mutateAsync(),
    }).catch(settleSensitiveAction);
  };

  const dueHint = !people.canRead
    ? undefined
    : deleted.length === 0
      ? t("retention.due.empty")
      : next
        ? t("retention.due.next", {
            count: deleted.length,
            n: counted ? n(deleted.length) : `${n(DELETED_PAGE)}+`,
            name: next.user.display_name?.trim() || next.user.email,
            deleted: formatDate(next.user.deleted_at, locale),
            date: formatDate(next.at, locale),
          })
        : t("retention.due.inDeleted", {
            count: deleted.length,
            n: counted ? n(deleted.length) : `${n(DELETED_PAGE)}+`,
          });

  return (
    <>
      <Section
        title={t("retention.deleted.title")}
        status={
          <Badge tone={on ? "success" : "neutral"} size="sm">
            {on ? t("retention.on") : t("retention.off")}
          </Badge>
        }
        description={t("retention.deleted.description")}
      >
        <dl className="account-details">
          <Detail
            label={t("retention.auto.label")}
            hint={on ? t("retention.auto.onHint") : t("retention.auto.offHint")}
            action={
              canWrite ? (
                <Button variant="ghost" onClick={toggle} loading={update.isPending && !editing}>
                  {on ? t("retention.auto.turnOff") : t("retention.auto.turnOn")}
                </Button>
              ) : undefined
            }
          >
            {on ? t("retention.on") : t("retention.off")}
          </Detail>
          {editing ? (
            <EditingDetail
              label={t("retention.keep.label")}
              buttons={
                <>
                  <Button
                    variant="ghost"
                    onClick={() => setEditing(false)}
                    disabled={update.isPending}
                  >
                    {t("retention.keep.cancel")}
                  </Button>
                  <Button onClick={saveDays} loading={update.isPending}>
                    {t("retention.keep.save")}
                  </Button>
                </>
              }
            >
              <NumberField
                aria-label={t("retention.keep.fieldLabel")}
                value={draft}
                onValueChange={(value) => {
                  setDraft(value);
                  setDraftError(undefined);
                }}
                min={RETENTION_DAYS.min}
                max={RETENTION_DAYS.max}
                step={1}
                endAdornment={t("retention.keep.unit")}
                autoFocus
              />
              <small className="cmp-hint" role={draftError ? "alert" : undefined}>
                {draftError ??
                  (counted && draft
                    ? t("retention.keep.wouldBeDue", {
                        count: dueCount(deleted, draft, now),
                        n: n(dueCount(deleted, draft, now)),
                        days: n(draft),
                      })
                    : t("retention.keep.range", {
                        min: RETENTION_DAYS.min,
                        max: n(RETENTION_DAYS.max),
                      }))}
              </small>
            </EditingDetail>
          ) : (
            <Detail
              label={t("retention.keep.label")}
              hint={t("retention.keep.hint", {
                min: RETENTION_DAYS.min,
                max: n(RETENTION_DAYS.max),
              })}
              action={
                canWrite ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setDraft(days);
                      setDraftError(undefined);
                      setEditing(true);
                    }}
                  >
                    {t("retention.keep.change")}
                  </Button>
                ) : undefined
              }
            >
              {t("retention.keep.days", { count: days, n: n(days) })}
            </Detail>
          )}
          <Detail
            label={t("retention.due.label")}
            hint={
              dueHint && !on && dueNow
                ? `${dueHint} ${t("retention.due.offNote")}`
                : (dueHint ?? (!on ? t("retention.due.offNote") : undefined))
            }
            action={
              canWrite && dueNow ? (
                <Button variant="ghost" onClick={removeNow} loading={run.isPending}>
                  {t("retention.removeNow.button")}
                </Button>
              ) : undefined
            }
          >
            {dueNow === undefined
              ? "—"
              : dueNow === 0
                ? t("retention.due.noOne")
                : t("retention.due.people", { count: dueNow, n: n(dueNow) })}
          </Detail>
          {canAudit ? (
            <Detail
              label={t("retention.evidence.label")}
              hint={
                soc || iso
                  ? [
                      soc
                        ? t("retention.evidence.soc2", {
                            date: formatDate(soc.generated_at, locale),
                          })
                        : null,
                      iso
                        ? t("retention.evidence.iso", {
                            date: formatDate(iso.generated_at, locale),
                          })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : t("retention.evidence.none")
              }
            >
              <span className="cmp-fact-value">
                <Code>CC6.5</Code>
                {statusIn(socRun, "CC6.5-RETAIN") ? (
                  <ControlBadge status={statusIn(socRun, "CC6.5-RETAIN") ?? "na"} />
                ) : null}
                <Code>A.8.3</Code>
                {statusIn(isoRun, "A.8.3-RETAIN") ? (
                  <ControlBadge status={statusIn(isoRun, "A.8.3-RETAIN") ?? "na"} />
                ) : null}
              </span>
            </Detail>
          ) : null}
        </dl>
      </Section>

      <Section title={t("retention.other.title")} description={t("retention.other.description")}>
        <ul className="account-rows">
          <Item
            icon={<ScrollTextIcon />}
            name={t("retention.other.audit")}
            badge={<Badge size="sm">{t("retention.other.auditKept")}</Badge>}
            line={t("retention.other.auditLine")}
            actions={
              canAudit ? (
                <Button
                  variant="ghost"
                  icon={ArrowRightIcon}
                  render={<Link to="/security/audit-logs" />}
                >
                  {t("retention.other.auditOpen")}
                </Button>
              ) : undefined
            }
          />
          <Item
            icon={<EraserIcon />}
            name={t("retention.other.erasure")}
            badge={
              <Badge size="sm">
                {t("retention.other.erasureKept", { days: ERASURE_GRACE_DAYS })}
              </Badge>
            }
            line={t("retention.other.erasureLine", { days: ERASURE_GRACE_DAYS })}
            actions={
              access.can("gdpr.write") ? (
                <Button
                  variant="ghost"
                  icon={ArrowRightIcon}
                  render={<Link to="/security/compliance/gdpr" />}
                >
                  {t("retention.other.erasureOpen")}
                </Button>
              ) : undefined
            }
          />
          <Item
            icon={<MonitorSmartphoneIcon />}
            name={t("retention.other.sessions")}
            badge={<Badge size="sm">{t("retention.other.sessionsKept")}</Badge>}
            line={t("retention.other.sessionsLine")}
          />
        </ul>
      </Section>
    </>
  );
}
