import { BotIcon, CopyIcon, SearchIcon, ShieldXIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  formatNumber,
  MenuItem,
  Select,
  Switch,
  Table,
  type TableColumn,
  Text,
} from "@qeetrix/react";
import {
  type AppliedFilter,
  DataState,
  EmptyState,
  FilterTags,
  PageContent,
  PageHeader,
  SearchField,
} from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { formatLocale } from "@/i18n";
import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import { useBotOverview, useBotSettings, useUpdateBotSettings } from "@/modules/security/api/bots";
import { useIpRules } from "@/modules/security/api/ip-allowlist";
import {
  type BotClient,
  type BotFilters,
  groupClients,
  isLocal,
  matchesClient,
  VERDICTS,
  type Verdict,
} from "@/modules/security/bot-model";
import { decide } from "@/modules/security/ip-model";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { BandPlaceholder } from "../band-placeholder";
import { BotsBand, CHALLENGE_FLOOR } from "./bots-band";
import { Detail, Section } from "../security-parts";
import { When } from "../when";
import { useDenyAddress } from "./use-deny-address";
import "../security.css";

const ANY = "";
// Each option's count is part of its label until Select items have a count of their own (QTRX-20).
const VERDICT_TONE = { blocked: "danger", challenged: "warning", allowed: "neutral" } as const;

export type BotsPageProps = {
  filters: BotFilters;
  onFiltersChange: (next: BotFilters) => void;
};

/**
 * Security › Threats › Bots: the automated clients trying to sign in, one row per client and
 * address from the server's last 50 scored sign-ins. Detection only: a password sign-in's user
 * agent is scored and the verdict recorded, and no sign-in is refused on it (bot.Evaluate). The
 * one setting that works sits under the list; honeypot, CAPTCHA and signature are stored but not
 * enforced, so they aren't offered (redesign-findings, Threat protection).
 */
export function BotsPage({ filters, onFiltersChange }: BotsPageProps) {
  const { t } = useTranslation("security");
  const access = useCapabilities();
  const canWrite = access.can("policy.write");
  const overview = useBotOverview();
  const denial = useDenyAddress();
  const rules = useIpRules();
  const events = overview.data?.recent ?? [];
  const stats = overview.data?.stats;
  const now = overview.dataUpdatedAt || Date.now();
  const clients = useMemo(() => groupClients(events), [events]);
  const rows = useMemo(() => clients.filter((c) => matchesClient(c, filters)), [clients, filters]);
  const filtered = !!(filters.q || filters.verdict);

  /** The allow rule that covers the address, by its label: one allow rule alone admits only its range. */
  const allowedBy = (ip: string) => {
    const rule = (rules.data?.items ?? []).find(
      (r) => r.action === "allow" && decide([r], ip).allowed,
    );
    return rule ? rule.label || rule.cidr : undefined;
  };

  const columns: TableColumn<BotClient>[] = [
    {
      id: "client",
      header: t("bots.columns.client"),
      primary: true,
      cell: (c) => (
        <span className="sec-two">
          <strong>{c.name || t("bots.noUserAgent")}</strong>
          <small className="sec-mono sec-clip" title={c.userAgent}>
            {c.userAgent || t("bots.sentNone")}
          </small>
        </span>
      ),
    },
    {
      id: "ip",
      header: t("bots.columns.address"),
      width: 200,
      cell: (c) => {
        const allowed = c.ip ? allowedBy(c.ip) : undefined;
        return (
          <span className="sec-two">
            <span className="sec-mono">{c.ip || "—"}</span>
            {isLocal(c.ip) ? (
              <small>{t("bots.local")}</small>
            ) : allowed ? (
              <small>{t("bots.allowedBy", { label: allowed })}</small>
            ) : null}
          </span>
        );
      },
    },
    {
      id: "count",
      header: t("bots.columns.signIns"),
      width: 96,
      numeric: true,
      cell: (c) => formatNumber(c.count),
    },
    {
      id: "verdict",
      header: t("bots.columns.verdict"),
      width: 148,
      cell: (c) => (
        <Badge size="sm" tone={VERDICT_TONE[c.verdict]}>
          {t(`bots.verdict.${c.verdict}`)}
        </Badge>
      ),
    },
    {
      id: "score",
      header: t("bots.columns.score"),
      width: 80,
      numeric: true,
      cell: (c) =>
        formatNumber(c.score, formatLocale(), {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
    },
    {
      id: "last",
      header: t("bots.columns.last"),
      width: 136,
      cell: (c) => <When at={c.last} now={now} />,
    },
  ];

  const copy = (ua: string) =>
    navigator.clipboard?.writeText(ua).then(
      () => toast.success(t("bots.copied")),
      () => toast.error(t("bots.copyFailed")),
    );

  return (
    <PageTabs>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("bots.title")}
        count={overview.data ? clients.length : undefined}
        status={<Badge tone="info">{t("bots.detectionOnly")}</Badge>}
        description={t("bots.description")}
        summary={
          overview.data && stats ? (
            <BotsBand events={events} stats={stats} clients={clients} now={now} />
          ) : overview.isError ? undefined : (
            <BandPlaceholder />
          )
        }
        tabs={<PageTabList />}
      />
      <PageContent>
        <div className="ppl">
          {overview.isError ? (
            <DataState error={overview.error} onRetry={() => overview.refetch()} />
          ) : (
            <Table<BotClient>
              label={t("bots.tableLabel")}
              rows={rows}
              rowId={(c) => c.id}
              rowLabel={(c) =>
                t("bots.rowLabel", { client: c.name || t("bots.noUserAgent"), ip: c.ip || "—" })
              }
              columns={columns}
              loading={overview.isLoading}
              toolbar={
                <BotsToolbar
                  filters={filters}
                  onFiltersChange={onFiltersChange}
                  clients={clients}
                  shown={rows.length}
                />
              }
              rowActions={(c) => {
                const denied = c.ip ? denial.deniedBy(c.ip) : undefined;
                return (
                  <>
                    {canWrite && c.ip && !denied && !isLocal(c.ip) ? (
                      <MenuItem
                        icon={ShieldXIcon}
                        tone="danger"
                        onClick={() =>
                          void denial.deny(
                            c.ip,
                            t("deny.label", { what: c.name || t("bots.noUserAgent") }),
                          )
                        }
                      >
                        {t("bots.actions.deny", { ip: c.ip })}
                      </MenuItem>
                    ) : null}
                    {c.ip ? (
                      <MenuItem
                        render={<Link to="/security/threats/anomalies" search={{ q: c.ip }} />}
                      >
                        {t("bots.actions.anomalies")}
                      </MenuItem>
                    ) : null}
                    <MenuItem
                      icon={CopyIcon}
                      disabled={!c.userAgent}
                      onClick={() => void copy(c.userAgent)}
                    >
                      {t("bots.actions.copy")}
                    </MenuItem>
                  </>
                );
              }}
              empty={
                filtered ? (
                  <EmptyState
                    size="section"
                    icon={SearchIcon}
                    title={t("bots.empty.filteredTitle")}
                    description={t("bots.empty.filteredDescription")}
                    actions={
                      <Button variant="ghost" onClick={() => onFiltersChange({})}>
                        {t("common.clearFilters")}
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    size="section"
                    icon={BotIcon}
                    title={t("bots.empty.title")}
                    description={t("bots.empty.description")}
                  />
                )
              }
            />
          )}
          <Detection canWrite={canWrite} />
        </div>
      </PageContent>
    </PageTabs>
  );
}

function BotsToolbar({
  filters,
  onFiltersChange,
  clients,
  shown,
}: {
  filters: BotFilters;
  onFiltersChange: (next: BotFilters) => void;
  clients: readonly BotClient[];
  shown: number;
}) {
  const { t } = useTranslation("security");
  const n = (value: number) => formatNumber(value, formatLocale());
  const searchRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(filters.q ?? "");
  useEffect(() => setText(filters.q ?? ""), [filters.q]);
  const set = (patch: Partial<BotFilters>) => onFiltersChange({ ...filters, ...patch });
  const tags: AppliedFilter[] = filters.verdict
    ? [
        {
          id: "verdict",
          label: t("bots.filters.verdict"),
          value: t(`bots.verdict.${filters.verdict}`),
        },
      ]
    : [];

  return (
    <div className="ppl-toolbar">
      <div className="ppl-filters">
        <SearchField
          ref={searchRef}
          className="ppl-search"
          aria-label={t("bots.filters.search")}
          placeholder={t("bots.filters.searchPlaceholder")}
          value={text}
          onValueChange={setText}
          onSearch={(q) => set({ q: q.trim() || undefined })}
        />
        <Select
          aria-label={t("bots.filters.verdict")}
          className="ppl-filter"
          value={filters.verdict ?? ANY}
          onValueChange={(value) => set({ verdict: VERDICTS.find((v) => v === value) })}
          items={[
            { value: ANY, label: t("bots.filters.anyVerdict") },
            ...VERDICTS.map((v: Verdict) => ({
              value: v,
              label: `${t(`bots.verdict.${v}`)} · ${n(clients.filter((c) => c.verdict === v).length)}`,
            })),
          ]}
        />
        <Text tone="subtle" size="sm" className="sec-toolbar-note">
          {t("bots.fromLatest")}
        </Text>
      </div>
      {/* Only once something narrows the list (FilterTags shows its summary even with none,
          QTRX-15). */}
      {tags.length || filters.q ? (
        <FilterTags
          filters={tags}
          onRemove={(id) => set({ [id]: undefined })}
          onClear={() => onFiltersChange({ q: filters.q })}
          returnFocusTo={searchRef}
          summary={t("bots.filters.summary", { n: n(shown), total: n(clients.length) })}
        />
      ) : null}
    </div>
  );
}

/** The one setting the scorer reads besides its threshold: whether sign-ins are scored at all. */
function Detection({ canWrite }: { canWrite: boolean }) {
  const { t } = useTranslation("security");
  const settings = useBotSettings();
  const update = useUpdateBotSettings();
  const runSensitive = useSensitiveAction();
  const s = settings.data;
  const threshold = s
    ? formatNumber(s.score_threshold, formatLocale(), { minimumFractionDigits: 2 })
    : "";

  // The server stores the whole object, so the settings it isn't offering go back as they came.
  const setScoring = (on: boolean) => {
    if (!s) return;
    runSensitive({
      capability: "policy.write",
      actionLabel: t("bots.detection.action"),
      run: () => update.mutateAsync({ ...s, ua_check: on }),
    }).catch(settleSensitiveAction);
  };

  return (
    <div className="sec-after-table">
      <Section title={t("bots.detection.title")} description={t("bots.detection.description")}>
        {settings.isError ? (
          <DataState error={settings.error} onRetry={() => settings.refetch()} />
        ) : (
          <dl className="account-details">
            <Detail
              label={t("bots.detection.scoring")}
              hint={s?.ua_check ? t("bots.detection.onHint") : t("bots.detection.offHint")}
              action={
                <Switch
                  aria-label={t("bots.detection.scoring")}
                  checked={s?.ua_check ?? false}
                  disabled={!s || !canWrite || update.isPending}
                  onCheckedChange={setScoring}
                />
              }
            >
              {s ? (s.ua_check ? t("common.on") : t("common.off")) : "—"}
            </Detail>
            <Detail
              label={t("bots.detection.wouldBlock")}
              hint={t("bots.detection.challengeHint", {
                from: formatNumber(CHALLENGE_FLOOR, formatLocale(), { minimumFractionDigits: 2 }),
              })}
            >
              {s ? t("bots.detection.atScore", { threshold }) : "—"}
            </Detail>
          </dl>
        )}
      </Section>
    </div>
  );
}
