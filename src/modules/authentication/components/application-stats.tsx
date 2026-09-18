import { cn, Skeleton, TimeSince } from "@qeetrix/ui";
import { ClockIcon, LayersIcon, LockIcon, UsersIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { OidcClient } from "../api/oidc-clients";

// Tinted icon squares, matching the StatCard tones used on the Applications
// section hub (modules/dashboard/components/applications-overview.tsx).
const TONES = {
  neutral: "bg-muted text-muted-foreground",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
} as const;

type Tone = keyof typeof TONES;

type StatCardProps = {
  icon: ReactNode;
  tone: Tone;
  label: string;
  value: ReactNode;
  caption: string;
};

function StatCard({ icon, tone, label, value, caption }: StatCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-lg [&_svg]:size-4.5",
          TONES[tone],
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-0.5 font-heading text-2xl font-semibold tabular-nums">{value}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{caption}</p>
      </div>
    </div>
  );
}

type ApplicationStatsProps = {
  clients: OidcClient[];
  isLoading?: boolean;
};

/**
 * The four-up summary above the applications table.
 *
 * Deliberately derived entirely from the list response — `auth.oidc_clients`
 * has no `updated_at`, so the fourth card reports the most recently *created*
 * client rather than the most recently modified one.
 */
export function ApplicationStats({ clients, isLoading }: ApplicationStatsProps) {
  const { t } = useTranslation("oidc");

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  const publicCount = clients.filter((c) => c.type === "public").length;
  const confidentialCount = clients.filter((c) => c.type === "confidential").length;

  // The backend already orders the list created_at DESC, but don't rely on it
  // for a headline number — pick the newest explicitly.
  const newest = clients.reduce<OidcClient | null>(
    (best, c) => (!best || c.created_at > best.created_at ? c : best),
    null,
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={<LayersIcon />}
        tone="neutral"
        label={t("stats.total")}
        value={clients.length.toLocaleString()}
        caption={t("stats.totalCaption")}
      />
      <StatCard
        icon={<UsersIcon />}
        tone="emerald"
        label={t("stats.public")}
        value={publicCount.toLocaleString()}
        caption={t("stats.publicCaption")}
      />
      <StatCard
        icon={<LockIcon />}
        tone="violet"
        label={t("stats.confidential")}
        value={confidentialCount.toLocaleString()}
        caption={t("stats.confidentialCaption")}
      />
      <StatCard
        icon={<ClockIcon />}
        tone="amber"
        label={t("stats.recent")}
        value={
          newest ? <TimeSince value={newest.created_at} className="text-2xl font-semibold" /> : "—"
        }
        caption={newest ? newest.name : t("stats.recentEmpty")}
      />
    </div>
  );
}
