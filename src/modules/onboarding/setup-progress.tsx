import { cn } from "@qeetrix/ui";
import { useTranslation } from "react-i18next";

export type SetupStep = "plan" | "profile" | "name";
export const SETUP_STEPS = ["plan", "profile", "name", "invite", "launch"] as const;

/** Invitations and launch happen after creation; they are guidance, not fake form steps. */
export function SetupProgress({ step }: { step: SetupStep }) {
  const { t } = useTranslation("dashboard");
  const current = SETUP_STEPS.indexOf(step);

  return (
    <nav aria-label={t("setup.progress.label")} className={cn(step === "plan" && "dark:hidden")}>
      <ol className="m-0 flex list-none items-center gap-3 p-0 @max-[680px]/setup:flex-wrap @max-[680px]/setup:gap-y-3">
        {SETUP_STEPS.map((id, index) => {
          const complete = index < current;
          const active = index === current;
          const status = complete ? "complete" : active ? "current" : index < 3 ? "next" : "later";

          return (
            <li
              key={id}
              aria-current={active ? "step" : undefined}
              className="flex min-w-0 flex-1 items-center gap-3 last:flex-none @max-[680px]/setup:basis-[30%] @max-[680px]/setup:last:flex-1"
            >
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full border text-xs",
                    step === "plan" && "size-6 text-[10px]",
                    complete
                      ? "border-emerald-600 bg-emerald-600 text-white ring-3 ring-emerald-500/10 dark:border-emerald-400/50 dark:bg-emerald-700"
                      : active
                        ? "border-[#f58228] bg-linear-135 from-[#ff7b0c] to-[#cc4000] text-white ring-3 ring-orange-500/10"
                        : "border-(--setup-border) bg-(--setup-soft)/50 text-(--setup-muted)",
                  )}
                >
                  {complete ? (
                    <svg
                      className="size-4"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="m5 10 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-[11px] leading-snug",
                      complete
                        ? "text-emerald-700 dark:text-emerald-400"
                        : active
                          ? "font-medium text-(--setup-text)"
                          : "text-(--setup-muted)",
                    )}
                  >
                    {t(`setup.progress.${id}`)}
                  </span>
                  {step !== "plan" && (
                    <span className="mt-0.5 block text-[10px] text-(--setup-muted)">
                      {t(`setup.progress.${status}`)}
                    </span>
                  )}
                </span>
              </div>
              {index < SETUP_STEPS.length - 1 && (
                <span
                  className="h-px min-w-4 flex-1 bg-(--setup-border) @max-[680px]/setup:hidden"
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
