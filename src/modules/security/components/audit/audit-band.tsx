import { Button, formatNumber } from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { Sparkline } from "@/modules/dashboard";
import type { AuditAnomalySummary } from "@/modules/security/api/audit-anomalies";
import { useAuditPulse } from "@/modules/security/api/audit-event";
import type { LogSink } from "@/modules/security/api/log-sinks";

export type ChainCheck =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "intact"; rows: number }
  | { state: "broken"; reason: "link" | "row" | "other" }
  | { state: "failed" };

/**
 * The log's key numbers, in its header above the tabs: the last 24 hours (the Activity summary
 * counts the same audit events), what's flagged as unusual, whether the hash chain is intact,
 * and where the log is streamed. The chain is checked on request: the check reads every event.
 */
export function AuditBand({
  flagged,
  sinks,
  chain,
  onCheckChain,
}: {
  flagged?: AuditAnomalySummary;
  sinks?: readonly LogSink[];
  chain: ChainCheck;
  onCheckChain: () => void;
}) {
  const { t } = useTranslation("security");
  const n = (value: number) => formatNumber(value, formatLocale());
  const pulse = useAuditPulse();
  const series = pulse.data?.series.map((b) => b.count) ?? [];
  const failing = (sinks ?? []).filter((s) => s.enabled && s.last_error).length;
  const streaming = (sinks ?? []).filter((s) => s.enabled).length;

  return (
    <dl className="ppl-band">
      <div className="ppl-cell">
        <dt className="ppl-label">{t("audit.band.day")}</dt>
        <dd className="ppl-value">{pulse.data ? n(pulse.data.total) : "—"}</dd>
        <dd className="ppl-note">
          {pulse.data
            ? t("audit.band.dayNote", {
                people: n(pulse.data.unique_actors),
                failed: n(pulse.data.by_outcome.failed ?? 0),
              })
            : t("audit.band.dayUnknown")}
        </dd>
        {series.length > 1 ? (
          <dd className="ppl-chart">
            <span
              role="img"
              aria-label={t("audit.band.dayLabel", { n: n(pulse.data?.total ?? 0) })}
            >
              <Sparkline values={series} width={132} height={40} />
            </span>
          </dd>
        ) : null}
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("audit.band.flagged")}</dt>
        <dd className="ppl-value">{flagged ? n(flagged.open) : "—"}</dd>
        <dd className={flagged?.high_score_open ? "ppl-note is-warning" : "ppl-note"}>
          {flagged
            ? t("audit.band.flaggedNote", {
                high: n(flagged.high_score_open),
                resolved: n(flagged.resolved_7d),
              })
            : t("audit.band.flaggedUnknown")}
        </dd>
        {flagged?.open ? (
          <dd className="ppl-link">
            <Link to="/security/audit-logs" search={{ view: "flagged" }}>
              {t("audit.band.showFlagged")}
            </Link>
          </dd>
        ) : null}
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("audit.band.chain")}</dt>
        <dd className="ppl-value">
          {chain.state === "intact"
            ? t("audit.chain.intact")
            : chain.state === "broken"
              ? t("audit.chain.broken")
              : t("audit.chain.unchecked")}
        </dd>
        <dd
          className={
            chain.state === "broken" || chain.state === "failed"
              ? "ppl-note is-warning"
              : "ppl-note"
          }
          aria-live="polite"
        >
          {chain.state === "intact"
            ? t("audit.chain.intactNote", { n: n(chain.rows) })
            : chain.state === "broken"
              ? t(`audit.chain.brokenNote.${chain.reason}`)
              : chain.state === "failed"
                ? t("audit.chain.failed")
                : t("audit.chain.what")}
        </dd>
        <dd className="ppl-link sec-band-action">
          <Button
            variant="ghost"
            size="sm"
            loading={chain.state === "checking"}
            onClick={onCheckChain}
          >
            {chain.state === "idle" ? t("audit.chain.check") : t("audit.chain.checkAgain")}
          </Button>
        </dd>
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("audit.band.streams")}</dt>
        <dd className="ppl-value">{sinks ? n(streaming) : "—"}</dd>
        <dd className={failing ? "ppl-note is-warning" : "ppl-note"}>
          {!sinks
            ? t("audit.band.streamsUnknown")
            : failing
              ? t("audit.band.streamsFailing", { count: failing })
              : streaming
                ? t("audit.band.streamsOk")
                : t("audit.band.streamsNone")}
        </dd>
        <dd className="ppl-link">
          <Link to="/security/log-streaming">{t("audit.band.openStreams")}</Link>
        </dd>
      </div>
    </dl>
  );
}
