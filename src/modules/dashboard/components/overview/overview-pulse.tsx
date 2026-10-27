// The pulse band across the top of the Dashboard: three measures with their trend, and two-step
// coverage on a meter with its target.

import { Meter } from "@qeetrix/react";
import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { AnalyticsOverview } from "@/modules/dashboard/api/analytics";
import { MFA_TARGET_PCT } from "@/modules/dashboard/overview-model";
import type { UserStats } from "@/modules/users";
import { CHART, num, Sparkline } from "./overview-parts";

// ── The pulse band ──────────────────────────────────────────────────────────────────────────

function Pulse({
  label,
  value,
  note,
  tone,
  children,
}: {
  label: string;
  value: ReactNode;
  note: ReactNode;
  tone?: "danger" | "warning";
  children?: ReactNode;
}) {
  return (
    <div className="overview-pulse-cell">
      <dt className="overview-pulse-label">{label}</dt>
      <dd className="overview-pulse-value">{value}</dd>
      <dd className={tone ? `overview-pulse-note is-${tone}` : "overview-pulse-note"}>{note}</dd>
      {children}
    </div>
  );
}

/** Four measures across the top: three with their trend, two-step coverage on a meter with its target. */
export function PulseBand({
  overview,
  stats,
}: {
  overview?: AnalyticsOverview;
  stats?: UserStats;
}) {
  const { t } = useTranslation("dashboard");
  const cells: ReactNode[] = [];
  if (overview) {
    const k = overview.kpis;
    const logins = overview.login_trend_14d.map((p) => p.value);
    const failed = overview.failed_trend_14d.map((p) => p.value);
    const yesterday = logins.at(-2) ?? 0;
    const trend =
      k.logins_today.value > yesterday ? "up" : k.logins_today.value < yesterday ? "down" : "same";
    cells.push(
      <Pulse
        key="signIns"
        label={t("overview.pulse.signIns")}
        value={num(k.logins_today.value)}
        note={t(`overview.pulse.signInsNote.${trend}`, { n: num(yesterday) })}
      >
        <dd className="overview-pulse-trend">
          <Sparkline values={logins} />
        </dd>
      </Pulse>,
      <Pulse
        key="failed"
        label={t("overview.pulse.failed")}
        value={num(k.failed_logins_24h.value)}
        note={t("overview.pulse.failedNote", { n: num(failed.at(-2) ?? 0) })}
        tone={k.failed_logins_24h.value > 0 ? "danger" : undefined}
      >
        <dd className="overview-pulse-trend">
          <Sparkline values={failed} color={CHART.bad} />
        </dd>
      </Pulse>,
      <Pulse
        key="active"
        label={t("overview.pulse.active")}
        value={num(k.dau.value)}
        note={t("overview.pulse.activeNote", {
          pct: Math.round(k.stickiness_pct.value),
          mau: num(k.mau.value),
        })}
      >
        <dd className="overview-pulse-trend">
          <Sparkline values={overview.weekly_activity_8w.map((w) => w.dau)} />
        </dd>
      </Pulse>,
    );
  }
  if (stats && stats.total > 0) {
    const share = Math.round((stats.mfa_enabled / stats.total) * 100);
    cells.push(
      <Pulse
        key="twoStep"
        label={t("overview.pulse.twoStep")}
        value={`${share}%`}
        note={t("overview.pulse.twoStepNote", {
          have: stats.mfa_enabled,
          total: stats.total,
          target: MFA_TARGET_PCT,
        })}
        tone={share < MFA_TARGET_PCT ? "warning" : undefined}
      >
        <dd className="overview-pulse-meter">
          <Meter
            value={share}
            tone={share < MFA_TARGET_PCT ? "warning" : "success"}
            aria-label={t("overview.pulse.twoStepMeter", { pct: share, target: MFA_TARGET_PCT })}
          />
          <span
            className="overview-pulse-target"
            style={{ insetInlineStart: `${MFA_TARGET_PCT}%` }}
            aria-hidden="true"
          />
        </dd>
      </Pulse>,
    );
  }
  if (!cells.length) return null;
  return (
    <dl
      className="overview-pulse"
      style={{ "--overview-pulse-cells": cells.length } as CSSProperties}
    >
      {cells}
    </dl>
  );
}
