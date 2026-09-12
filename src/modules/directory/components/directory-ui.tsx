import {
  Button,
  cn,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@qeetrix/ui";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshCwIcon,
  SearchIcon,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Cell, Pie, PieChart } from "recharts";

export const DIRECTORY_PAGE =
  "@container/directory-page relative isolate flex min-w-0 flex-col gap-4 before:pointer-events-none before:absolute before:-inset-4 before:-z-10 before:bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] before:bg-size-[32px_32px] before:opacity-10 dark:before:opacity-5";
export const DIRECTORY_PANEL =
  "min-w-0 overflow-hidden rounded-lg border border-border/65 bg-card/90 shadow-[0_2px_10px_color-mix(in_oklab,var(--foreground)_2%,transparent)] dark:bg-card/65 dark:shadow-none";
export const DIRECTORY_ACTION = "h-8 gap-2 rounded-md px-3 text-xs pointer-coarse:min-h-11";

export function DirectoryDonut({
  values,
  value,
  label,
}: {
  values: { label: string; count: number; color: string }[];
  value: string;
  label: string;
}) {
  const total = values.reduce((sum, item) => sum + item.count, 0);
  const data = total > 0 ? values : [{ label, count: 1, color: "var(--muted)" }];
  return (
    <div className="relative size-32 shrink-0" role="img" aria-label={`${value} ${label}`}>
      <PieChart width={128} height={128}>
        <Pie
          data={data}
          dataKey="count"
          nameKey="label"
          cx={59}
          cy={59}
          innerRadius={42}
          outerRadius={58}
          startAngle={90}
          endAngle={-270}
          stroke="var(--card)"
          strokeWidth={2}
          isAnimationActive={false}
        >
          {data.map((item) => (
            <Cell key={item.label} fill={item.color} />
          ))}
        </Pie>
      </PieChart>
      <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
        <strong className="font-heading text-lg tabular-nums">{value}</strong>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

const TONES = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  danger: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  info: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
};

export function DirectorySelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Select
      value={value || "all"}
      onValueChange={(next) => next && onChange(next === "all" ? "" : next)}
    >
      <SelectTrigger aria-label={label} className="h-8 min-w-36 text-xs pointer-coarse:min-h-11">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DirectorySearch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative min-w-40 flex-1">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 ps-8 text-xs pointer-coarse:min-h-11"
      />
    </div>
  );
}

export function DirectoryPagination({
  total,
  limit,
  offset,
  busy,
  onChange,
}: {
  total: number;
  limit: number;
  offset: number;
  busy: boolean;
  onChange: (offset: number) => void;
}) {
  const { t } = useTranslation("dashboard");
  return (
    <footer className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
      <span>
        {t("directory.pagination", {
          from: total ? offset + 1 : 0,
          to: Math.min(offset + limit, total),
          total,
        })}
      </span>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("directory.previous")}
          disabled={busy || offset === 0}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("directory.next")}
          disabled={busy || offset + limit >= total}
          onClick={() => onChange(offset + limit)}
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </footer>
  );
}

export function formatDirectoryDuration(milliseconds: number | null | undefined): string | null {
  if (milliseconds == null) return null;
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`;
  const seconds = Math.round(milliseconds / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function DirectoryStat({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
  loading = false,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  loading?: boolean;
}) {
  const { t } = useTranslation("dashboard");
  return (
    <article className={cn(DIRECTORY_PANEL, "flex gap-3 px-4 py-4")} aria-label={label}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", TONES[tone])}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[11px] leading-4 text-muted-foreground">{label}</h2>
        <div className="mt-1 min-h-7 font-heading text-2xl leading-7 font-semibold tabular-nums">
          {loading ? (
            <Skeleton className="h-7 w-12" />
          ) : (
            (value ?? (
              <span className="text-base text-muted-foreground">{t("directory.notReported")}</span>
            ))
          )}
        </div>
        {detail ? (
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{detail}</p>
        ) : null}
      </div>
    </article>
  );
}

export function DirectoryStatus({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: keyof typeof TONES;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-1 text-[11px] leading-3 font-medium",
        TONES[tone],
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}

export function DirectoryQueryError({ retry, busy }: { retry: () => unknown; busy: boolean }) {
  const { t } = useTranslation("dashboard");
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm"
    >
      <p>{t("directory.loadError")}</p>
      <Button variant="outline" size="sm" onClick={() => void retry()} disabled={busy}>
        <RefreshCwIcon className={cn(busy && "motion-safe:animate-spin")} /> {t("directory.retry")}
      </Button>
    </div>
  );
}

export function DirectoryPanel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={cn(DIRECTORY_PANEL, "p-4")} aria-label={title}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-semibold">{title}</h2>
          {description ? (
            <p className="mt-1 text-xs leading-4 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
