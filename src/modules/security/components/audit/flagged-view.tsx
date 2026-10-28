import { SlidersHorizontalIcon, SparklesIcon } from "@qeetrix/icons";
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  Field,
  formatNumber,
  MenuItem,
  Select,
  Switch,
  Table,
  type TableColumn,
  Text,
} from "@qeetrix/react";
import { DataState, EmptyState, NumberField, Pagination } from "@qeetrix/react/experimental";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import {
  type AuditAnomaly,
  type AuditAnomalySettings,
  type AuditAnomalySummary,
  useAuditAnomalySettings,
  useUpdateAuditAnomalySettings,
} from "@/modules/security/api/audit-anomalies";
import { errorMessage } from "@/platform/errors/user-message";
import {
  SensitiveActionCancelled,
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { Failure } from "../security-parts";
import type { Person } from "../use-people";
import { When } from "../when";
import { EventCell } from "./audit-cells";
import { ScoreBadge, reasonsText } from "./flagged-parts";

const PAGE_SIZE = 25;

/**
 * Flagged: today's Intelligence page, folded into the log as a view of it. Each admin action is
 * scored against the person's own history (a first-time action 0.50, an unusual hour up to 0.30,
 * a new address 0.20) once they have enough of it, and flagged at the organisation's threshold
 * (audit/anomaly). Resolving one marks it reviewed; nothing else changes.
 */
export function FlaggedView({
  items,
  loading,
  error,
  onRetry,
  status,
  onStatusChange,
  summary,
  people,
  now,
  viewSwitch,
  canResolve,
  canChange,
  onOpen,
  onResolve,
  onActor,
}: {
  items: readonly AuditAnomaly[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  status: "open" | "resolved";
  onStatusChange: (status: "open" | "resolved") => void;
  summary?: AuditAnomalySummary;
  people: ReadonlyMap<string, Person>;
  now: number;
  viewSwitch: ReactNode;
  canResolve: boolean;
  canChange: boolean;
  onOpen: (a: AuditAnomaly) => void;
  onResolve: (a: AuditAnomaly) => void;
  onActor: (actorUserId: string) => void;
}) {
  const { t } = useTranslation("security");
  const n = (value: number) => formatNumber(value, formatLocale());
  const [offset, setOffset] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const start = offset < items.length ? offset : 0;
  const onPage = items.slice(start, start + PAGE_SIZE);

  const columns: TableColumn<AuditAnomaly>[] = [
    {
      id: "score",
      header: t("audit.flagged.columns.score"),
      width: 124,
      cell: (a) => <ScoreBadge score={a.score} />,
    },
    {
      id: "action",
      header: t("audit.flagged.columns.action"),
      primary: true,
      cell: (a) => <EventCell action={a.action} />,
    },
    {
      id: "by",
      header: t("audit.flagged.columns.by"),
      cell: (a) => {
        const p = a.actor_user_id ? people.get(a.actor_user_id) : undefined;
        return (
          <span className="sec-two">
            <span>{p?.name ?? a.actor_email ?? "—"}</span>
            {p ? <small>{p.email}</small> : null}
          </span>
        );
      },
    },
    {
      id: "why",
      header: t("audit.flagged.columns.why"),
      cell: (a) => (
        <span className="sec-two">
          <span>{reasonsText(t, a.reasons)}</span>
          {a.ip ? <small className="sec-mono">{a.ip}</small> : null}
        </span>
      ),
    },
    {
      id: "when",
      header: t("audit.columns.when"),
      width: 136,
      cell: (a) => <When at={a.event_at} now={now} />,
    },
  ];

  return (
    <>
      {error ? (
        <DataState error={error} onRetry={onRetry} />
      ) : (
        <Table<AuditAnomaly>
          label={t("audit.flagged.label")}
          rows={onPage}
          rowId={(a) => a.id}
          rowLabel={(a) =>
            t("audit.flagged.rowLabel", { action: a.action, who: a.actor_email ?? "—" })
          }
          columns={columns}
          loading={loading}
          onRowClick={onOpen}
          toolbar={
            <div className="ppl-toolbar">
              <div className="ppl-filters">
                {viewSwitch}
                <Select
                  aria-label={t("audit.flagged.status")}
                  className="ppl-filter"
                  value={status}
                  onValueChange={(value) =>
                    onStatusChange(value === "resolved" ? "resolved" : "open")
                  }
                  items={[
                    {
                      value: "open",
                      label: summary
                        ? `${t("audit.flagged.open")} · ${n(summary.open)}`
                        : t("audit.flagged.open"),
                    },
                    { value: "resolved", label: t("audit.flagged.resolved") },
                  ]}
                />
                {summary ? (
                  <Text tone="subtle" size="sm" className="sec-toolbar-note">
                    {t("audit.flagged.note", {
                      high: n(summary.high_score_open),
                      resolved: n(summary.resolved_7d),
                    })}
                  </Text>
                ) : null}
                <Button
                  variant="ghost"
                  icon={SlidersHorizontalIcon}
                  className="sec-toolbar-end"
                  onClick={() => setSettingsOpen(true)}
                >
                  {t("audit.detection.open")}
                </Button>
              </div>
            </div>
          }
          rowActions={(a) => (
            <>
              <MenuItem onClick={() => onOpen(a)}>{t("audit.actions.open")}</MenuItem>
              {canResolve && a.status === "open" ? (
                <MenuItem onClick={() => onResolve(a)}>{t("audit.flagged.resolve")}</MenuItem>
              ) : null}
              {a.actor_user_id ? (
                <MenuItem onClick={() => onActor(a.actor_user_id ?? "")}>
                  {t("audit.actions.eventsByThem")}
                </MenuItem>
              ) : null}
            </>
          )}
          empty={
            <EmptyState
              size="section"
              icon={SparklesIcon}
              title={
                status === "open" ? t("audit.flagged.emptyOpen") : t("audit.flagged.emptyResolved")
              }
              description={t("audit.flagged.emptyDescription")}
            />
          }
        />
      )}
      {items.length > PAGE_SIZE ? (
        <Pagination
          offset={start}
          pageSize={PAGE_SIZE}
          itemsOnPage={onPage.length}
          total={items.length}
          onOffsetChange={setOffset}
        />
      ) : null}
      <DetectionDrawer open={settingsOpen} onOpenChange={setSettingsOpen} canChange={canChange} />
    </>
  );
}

/** How unusual an action must be before it's flagged, and how much history a person needs first. */
function DetectionDrawer({
  open,
  onOpenChange,
  canChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canChange: boolean;
}) {
  const { t } = useTranslation("security");
  const settings = useAuditAnomalySettings();
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        size="sm"
        title={t("audit.detection.title")}
        description={t("audit.detection.description")}
      >
        {settings.data ? (
          <DetectionForm
            key={settings.dataUpdatedAt}
            settings={settings.data}
            canChange={canChange}
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <DrawerBody>
            <DataState
              loading={settings.isLoading}
              error={settings.isError ? settings.error : undefined}
              onRetry={() => settings.refetch()}
            />
          </DrawerBody>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function DetectionForm({
  settings,
  canChange,
  onDone,
}: {
  settings: AuditAnomalySettings;
  canChange: boolean;
  onDone: () => void;
}) {
  const { t } = useTranslation("security");
  const runSensitive = useSensitiveAction();
  const update = useUpdateAuditAnomalySettings();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [threshold, setThreshold] = useState<number | null>(settings.score_threshold);
  const [baseline, setBaseline] = useState<number | null>(settings.min_baseline_events);
  const [failure, setFailure] = useState<string | null>(null);
  const thresholdError =
    threshold === null || threshold < 0 || threshold > 1
      ? t("audit.detection.thresholdRange")
      : undefined;
  const baselineError =
    baseline === null || baseline < 0 || !Number.isInteger(baseline)
      ? t("audit.detection.baselineRange")
      : undefined;
  const changed =
    enabled !== settings.enabled ||
    threshold !== settings.score_threshold ||
    baseline !== settings.min_baseline_events;

  const save = () => {
    if (thresholdError || baselineError || threshold === null || baseline === null) return;
    setFailure(null);
    runSensitive({
      capability: "audit.write",
      actionLabel: t("audit.detection.action"),
      run: () =>
        update.mutateAsync({ enabled, score_threshold: threshold, min_baseline_events: baseline }),
    })
      .then((saved) => saved && onDone())
      .catch((err: unknown) => {
        if (!(err instanceof SensitiveActionCancelled)) setFailure(errorMessage(err));
        settleSensitiveAction(err);
      });
  };

  return (
    <>
      <DrawerBody>
        <form
          id="detection-settings"
          className="sec-drawer sec-drawer-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Switch
            label={t("audit.detection.enabled")}
            description={t("audit.detection.enabledHint")}
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={!canChange}
          />
          <Field
            label={t("audit.detection.threshold")}
            description={t("audit.detection.thresholdHint")}
            error={thresholdError}
          >
            <NumberField
              value={threshold}
              onValueChange={setThreshold}
              min={0}
              max={1}
              step={0.05}
              disabled={!canChange}
            />
          </Field>
          <Field
            label={t("audit.detection.baseline")}
            description={t("audit.detection.baselineHint")}
            error={baselineError}
          >
            <NumberField
              value={baseline}
              onValueChange={setBaseline}
              min={0}
              step={1}
              endAdornment={t("audit.detection.events")}
              disabled={!canChange}
            />
          </Field>
          {failure ? <Failure>{failure}</Failure> : null}
        </form>
      </DrawerBody>
      <DrawerFooter>
        <DrawerClose render={<Button variant="ghost">{t("common.cancel")}</Button>} />
        {canChange ? (
          <Button
            type="submit"
            form="detection-settings"
            loading={update.isPending}
            disabled={!changed}
          >
            {t("common.save")}
          </Button>
        ) : null}
      </DrawerFooter>
    </>
  );
}
