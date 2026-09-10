// Feature-local Tailwind tokens. Never override the sidebar or application theme.
export const SETUP_THEME =
  "font-sans text-(--setup-text) [--setup-text:var(--foreground)] [--setup-muted:var(--muted-foreground)] [--setup-surface:var(--card)] [--setup-soft:var(--surface-subtle)] [--setup-border:#e2e8f0] [--setup-accent:#d54b00] [--setup-accent-soft:#fff1e8] dark:[--setup-text:#eef2f7] dark:[--setup-muted:#b1bdce] dark:[--setup-surface:#111a22] dark:[--setup-soft:#19232d] dark:[--setup-border:#2b3946] dark:[--setup-accent:#ff963f] dark:[--setup-accent-soft:#302218]";

export const SETUP_PANEL =
  "min-w-0 rounded-[10px] border border-(--setup-border) bg-(--setup-surface) shadow-[0_2px_8px_rgb(30_50_75/0.025)] dark:bg-linear-135 dark:from-white/2 dark:to-transparent dark:shadow-none";

export const SETUP_FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-(--setup-accent) disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none";

export const SETUP_PRIMARY =
  "h-9 rounded-lg border border-[#ee680a] bg-linear-105 from-[#f97709] via-[#d64a00] via-35% to-[#d94d00] px-5 text-xs font-semibold text-white shadow-[inset_0_1px_1px_rgb(255_205_146/0.22)] hover:brightness-105 dark:shadow-[0_0_16px_rgb(238_97_15/0.12),inset_0_1px_1px_rgb(255_205_146/0.22)] pointer-coarse:min-h-11";

export const SETUP_SECONDARY =
  "h-9 rounded-lg border border-(--setup-border) bg-(--setup-soft) px-4 text-xs text-(--setup-text) hover:bg-(--setup-border)/35 pointer-coarse:min-h-11";

export const SETUP_FIELDS =
  "gap-5 [&_[data-slot=field]]:gap-1 [&_[data-slot=field-label]]:text-xs [&_[data-slot=field-label]]:font-medium [&_[data-slot=field-description]]:text-[10px] [&_[data-slot=field-description]]:text-(--setup-muted) [&_[data-slot=input]]:h-7 [&_[data-slot=input]]:rounded-md [&_[data-slot=input]]:border-(--setup-border) [&_[data-slot=input]]:bg-(--setup-soft)/35 [&_[data-slot=input]]:text-xs [&_[data-slot=input]]:placeholder:text-(--setup-muted) [&_[data-slot=select-trigger]]:h-7 [&_[data-slot=select-trigger]]:w-full [&_[data-slot=select-trigger]]:rounded-md [&_[data-slot=select-trigger]]:border-(--setup-border) [&_[data-slot=select-trigger]]:bg-(--setup-soft)/35 [&_[data-slot=select-trigger]]:text-xs [&_[data-slot=select-trigger]]:text-(--setup-muted) pointer-coarse:[&_[data-slot=input]]:min-h-11 pointer-coarse:[&_[data-slot=input]]:text-base pointer-coarse:[&_[data-slot=select-trigger]]:min-h-11";
