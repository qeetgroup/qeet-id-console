// KPI cards atop the Organizations table. All counts are real (computed from the
// enriched caller-scoped tenant list). No sparklines — there is no meaningful
// per-day org trend; proportion cards show a meter instead.

import { cn, Skeleton } from "@qeetrix/ui";
import {
  Building2Icon,
  ChevronRightIcon,
  type LucideIcon,
  ShieldCheckIcon,
  UserXIcon,
  Users2Icon,
  UsersIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type { Org } from "./api/orgs";

export type OrgKpiFilter = "all" | "active" | "suspended";

type Tone = "brand" | "success" | "danger" | "muted";

const TONE: Record<Tone, { chip: string; icon: string; bar: string }> = {
  brand: { chip: "bg-primary/10 text-primary", icon: "text-primary", bar: "bg-primary" },
  success: { chip: "bg-success/10 text-success", icon: "text-success", bar: "bg-success" },
  danger: {
    chip: "bg-destructive/10 text-destructive",
    icon: "text-destructive",
    bar: "bg-destructive",
  },
  muted: {
    chip: "bg-muted text-muted-foreground",
    icon: "text-muted-foreground",
    bar: "bg-muted-foreground",
  },
};

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 1000) / 10 : 0;
}

export function OrgsKpis({
  orgs,
  loading,
  onFilter,
}: {
  orgs: Org[];
  loading: boolean;
  onFilter: (f: OrgKpiFilter) => void;
}) {
  const { t } = useTranslation("organizations");

  if (loading && orgs.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  const total = orgs.length;
  const active = orgs.filter((o) => o.status === "active").length;
  const suspended = orgs.filter((o) => o.status === "suspended").length;
  const members = orgs.reduce((s, o) => s + (o.member_count ?? 0), 0);
  const mfaMembers = orgs.reduce((s, o) => s + (o.mfa_enabled_count ?? 0), 0);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <Kpi
        icon={Building2Icon}
        tone="brand"
        label={t("kpi.total")}
        value={total}
        onClick={() => onFilter("all")}
      />
      <Kpi
        icon={Users2Icon}
        tone="success"
        label={t("kpi.active")}
        value={active}
        meter={pct(active, total)}
        onClick={() => onFilter("active")}
      />
      <Kpi
        icon={UserXIcon}
        tone="danger"
        label={t("kpi.suspended")}
        value={suspended}
        meter={pct(suspended, total)}
        onClick={() => onFilter("suspended")}
      />
      <Kpi
        icon={UsersIcon}
        tone="muted"
        label={t("kpi.members")}
        value={members}
        onClick={() => onFilter("all")}
      />
      <Kpi
        icon={ShieldCheckIcon}
        tone="success"
        label={t("kpi.mfaMembers")}
        value={mfaMembers}
        meter={pct(mfaMembers, members)}
        onClick={() => onFilter("all")}
      />
    </div>
  );
}

function Kpi({
  icon: Icon,
  tone,
  label,
  value,
  meter,
  onClick,
}: {
  icon: LucideIcon;
  tone: Tone;
  label: string;
  value: number;
  meter?: number;
  onClick: () => void;
}) {
  const { t } = useTranslation("organizations");
  const c = TONE[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-colors hover:border-foreground/20 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("flex size-6 items-center justify-center rounded-md", c.chip)}>
            <Icon className={cn("size-3.5", c.icon)} aria-hidden="true" />
          </span>
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
        </div>
        <ChevronRightIcon className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
      </div>
      <div className="text-2xl font-semibold tabular-nums tracking-tight">
        {value.toLocaleString()}
      </div>
      {meter !== undefined ? (
        <>
          <div className="text-xs text-muted-foreground">{t("kpi.ofTotal", { pct: meter })}</div>
          <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", c.bar)}
              style={{ width: `${Math.min(100, meter)}%` }}
            />
          </div>
        </>
      ) : (
        <div className="h-[1.375rem]" />
      )}
    </button>
  );
}
