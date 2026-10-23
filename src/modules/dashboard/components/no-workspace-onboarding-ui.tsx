import { cn } from "@qeetrix/ui";
import type { ComponentProps, ReactNode } from "react";

// Shared look of the no-organization welcome screen; the colours are its `--welcome-*` variables.
export const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--welcome-orange) disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none";
export const DETAIL = "font-sans text-[11px] leading-normal text-(--welcome-muted)";
export const ITEM_TITLE = "m-0 font-sans text-[11px] font-semibold leading-normal";
const ICON_TONES = {
  brand: "bg-(--welcome-orange-soft) text-(--welcome-orange)",
  success: "bg-(--welcome-green-soft) text-(--welcome-green)",
  info: "bg-(--welcome-blue-soft) text-(--welcome-blue)",
  neutral: "bg-(--welcome-soft) text-(--welcome-muted)",
};

export function WelcomePanel({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-lg border border-(--welcome-border) bg-(--welcome-surface) p-4 shadow-(--welcome-shadow)",
        className,
      )}
      {...props}
    />
  );
}

export function WelcomeIcon({
  children,
  tone = "brand",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof ICON_TONES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-lg border border-transparent [&>svg]:size-5.5",
        "dark:border-current/15 dark:shadow-[inset_0_1px_8px_rgb(255_255_255/0.02)]",
        ICON_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  id,
  icon,
  title,
  description,
  tone,
  className,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
  tone?: keyof typeof ICON_TONES;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-4 @max-[480px]/welcome:items-start @max-[480px]/welcome:gap-2.5",
        className,
      )}
    >
      <WelcomeIcon tone={tone}>{icon}</WelcomeIcon>
      <div className="min-w-0">
        <h2 id={id} className="m-0 font-sans text-[13px] font-semibold leading-normal">
          {title}
        </h2>
        <p className={cn("mt-0.5", DETAIL)}>{description}</p>
      </div>
    </div>
  );
}
