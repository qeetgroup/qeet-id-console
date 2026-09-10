import { Category, More, People, ShieldTick } from "@qeetrix/icons";
import { cn } from "@qeetrix/ui";
import { QeetLogoMark } from "@qeetrix/ui/brand";
import { useId } from "react";
import { useTranslation } from "react-i18next";

export type SetupArtworkProps = { className?: string };

const GLASS = cn(
  "rounded-xl border border-white/85 bg-white/70 backdrop-blur-sm",
  "shadow-lg shadow-orange-950/5 dark:border-orange-400/25 dark:bg-neutral-900/80",
);
const PLAN_ITEMS = [
  ["setup.artwork.users", People],
  ["setup.artwork.applications", Category],
  ["setup.artwork.security", ShieldTick],
  ["setup.artwork.more", More],
] as const;

/** Original, non-interactive artwork; all copy is decorative and localized by the caller's i18n. */
export function SetupPlanArtwork({ className }: SetupArtworkProps = {}) {
  const { t } = useTranslation("dashboard");
  const globeId = useId();

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none relative isolate h-37.5 w-full max-w-80 overflow-hidden select-none",
        className,
      )}
    >
      <div className="absolute inset-0 dark:hidden">
        <div className="absolute -top-1 left-7 size-38 rounded-full bg-linear-to-br from-orange-100/85 to-amber-50/20 ring-1 ring-white/60" />
        <div className="absolute right-4 bottom-1 h-18 w-27 bg-[radial-gradient(var(--setup-accent)_0.7px,transparent_0.8px)] bg-size-[6px_6px] opacity-30" />
        <div className={cn(GLASS, "absolute top-11 left-3 w-39 -rotate-6 p-3")}>
          <div className="absolute -top-5 left-4 grid size-8 place-items-center rounded-lg border border-orange-200/70 bg-orange-50 shadow-sm shadow-orange-950/5">
            <QeetLogoMark size={21} variant="on-light" />
          </div>
          <p className="mt-1 truncate text-[10px] font-medium text-(--setup-text)">
            {t("setup.artwork.organization")}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-(--setup-border)/60 pt-2">
            {["w-5", "w-4", "w-6"].map((width) => (
              <div
                key={width}
                className="rounded border border-(--setup-border)/70 bg-(--setup-soft)/50 p-1"
              >
                <span className={cn("block h-0.5 rounded-full bg-(--setup-muted)/35", width)} />
              </div>
            ))}
          </div>
        </div>
        <div className={cn(GLASS, "absolute top-6 right-3 w-36 rotate-6 space-y-2 p-3")}>
          {PLAN_ITEMS.map(([key, Icon]) => (
            <div key={key} className="flex items-center gap-2 text-[10px] text-(--setup-muted)">
              <Icon className="size-3.5 shrink-0" />
              <span className="truncate">{t(key)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute inset-0 hidden dark:block">
        <div className="absolute -top-5 right-1 size-40 rounded-full bg-(--setup-accent)/15 blur-2xl" />
        <svg
          viewBox="0 0 180 180"
          className="absolute -top-7 -right-1 size-45 rotate-[-18deg] [&_stop]:[stop-color:var(--setup-accent)]"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id={globeId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" className="[stop-opacity:0.03]" />
              <stop offset="60%" className="[stop-opacity:0.9]" />
              <stop offset="100%" className="[stop-opacity:0.45]" />
            </linearGradient>
          </defs>
          <g stroke={`url(#${globeId})`} className="fill-none stroke-[0.7]">
            <circle cx="90" cy="90" r="80" />
            <path d="M90 10C-6 10-6 170 90 170S186 10 90 10Z" />
            <path d="M90 10C26 10 26 170 90 170S154 10 90 10Z" />
            <path d="M90 10C58 10 58 170 90 170S122 10 90 10Z" />
            <path d="M90 10V170M44 25Q90 42 136 25M21 50Q90 78 159 50" />
            <path d="M10 90Q90 126 170 90M21 130Q90 153 159 130M44 155Q90 166 136 155" />
          </g>
        </svg>
        <div className="relative z-10 flex h-full max-w-44 flex-col justify-center gap-3">
          <p className="text-lg leading-6 font-semibold tracking-tight text-(--setup-text)">
            <span className="block">{t("setup.artwork.headlineFirst")}</span>
            <span className="block">{t("setup.artwork.headlineSecond")}</span>
          </p>
          <p className="text-[11px] leading-4 text-(--setup-muted)">{t("setup.artwork.caption")}</p>
        </div>
      </div>
    </div>
  );
}

/** Small glass browser layers for the foot of a setup help panel. */
export function SetupWindowArtwork({ className }: SetupArtworkProps = {}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none relative isolate h-37.5 w-full max-w-45 overflow-hidden select-none",
        className,
      )}
    >
      <div className="relative h-37.5 w-45 origin-top-left scale-[var(--setup-window-scale,1)]">
        <div className="absolute top-7 left-4 size-28 rounded-full bg-orange-100/75 dark:bg-orange-500/10" />
        <div className="absolute top-3 right-1 size-24 rounded-full bg-(--setup-accent)/20 blur-2xl" />
        {["top-7 left-10 w-30 opacity-65", "top-14 left-3 w-32"].map((position) => (
          <div key={position} className={cn(GLASS, "absolute h-20 -skew-y-12", position)}>
            <div className="flex h-5 items-center gap-1 border-b border-(--setup-border)/60 px-2">
              {["first", "second", "third"].map((dot) => (
                <span key={dot} className="size-1 rounded-full bg-(--setup-accent)/40" />
              ))}
            </div>
            <div className="flex h-14 items-center gap-3 px-3">
              <QeetLogoMark size={23} />
              <div className="flex-1 space-y-2">
                <div className="h-1 w-9 rounded-full bg-(--setup-muted)/25" />
                <div className="h-1 w-6 rounded-full bg-(--setup-accent)/30" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
