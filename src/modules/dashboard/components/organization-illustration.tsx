import { ShieldTick, User } from "@qeetrix/icons";
import { cn } from "@qeetrix/ui";
import { QeetLogoMark } from "@qeetrix/ui/brand";

const PLANE = "absolute grid -skew-y-[19deg] place-items-center rounded-md border";

/** Decorative identity layers styled entirely with Tailwind utilities. */
export function OrganizationIllustration() {
  return (
    <div
      data-slot="organization-illustration"
      className="pointer-events-none absolute top-1/2 -right-3.5 z-0 h-60 w-45 -translate-y-1/2 @max-[920px]/welcome:-right-6 @max-[920px]/welcome:origin-top-right @max-[920px]/welcome:scale-80 @max-[760px]/welcome:right-0 @max-[760px]/welcome:scale-100 @max-[480px]/welcome:hidden"
      aria-hidden="true"
    >
      <div className="absolute -inset-8 bg-[radial-gradient(ellipse,rgb(255_125_43/0.09),transparent_67%)] dark:bg-[radial-gradient(ellipse,rgb(255_116_24/0.18),transparent_70%)]" />
      <div className="absolute inset-x-0 top-8 bottom-2 bg-[radial-gradient(var(--welcome-orange)_0.65px,transparent_0.8px)] bg-size-[8px_8px] opacity-30 mask-[radial-gradient(ellipse,#000_20%,transparent_78%)] dark:opacity-65" />
      <div className="absolute top-10 left-23 h-44 w-px bg-linear-to-b from-(--welcome-orange) via-transparent via-45% to-(--welcome-orange) opacity-65 before:absolute before:-left-0.5 before:size-1.25 before:rounded-full before:border before:border-(--welcome-orange) before:bg-(--welcome-surface) before:content-[''] after:absolute after:bottom-0 after:-left-0.5 after:size-1.25 after:rounded-full after:border after:border-(--welcome-orange) after:bg-(--welcome-surface) after:content-['']" />
      <div className="absolute top-20 left-10.5 size-25 -skew-y-[19deg] border border-(--welcome-orange)/70" />
      <div
        className={cn(
          PLANE,
          "top-6.5 left-4 h-19 w-14 border-[#ffdbbf] bg-linear-145 from-[#fff3e9] to-[#ffefe2]/40 text-[#f4bc98] dark:border-[#986033] dark:bg-linear-135 dark:from-[#50331f] dark:to-[#41291d]/80 dark:text-[#ffae72]",
        )}
      >
        <User className="size-7" variant="solid" />
      </div>
      <div
        className={cn(
          PLANE,
          "top-24 left-16 z-1 size-13.5 border-[#ffc491] bg-linear-125 from-[#ffe1c7] to-[#ffb47c] shadow-[0_8px_22px_rgb(255_111_25/0.07)] dark:border-[#fda260] dark:bg-linear-135 dark:from-[#ffc58f] dark:via-[#ff8234] dark:via-65% dark:to-[#f57124] dark:shadow-[inset_0_1px_3px_rgb(255_255_255/0.25),0_4px_30px_rgb(255_112_20/0.15)]",
        )}
      >
        <QeetLogoMark className="skew-y-[19deg]" size={34} variant="on-light" />
      </div>
      <div
        className={cn(
          PLANE,
          "top-30.5 left-28 h-18 w-14 border-(--welcome-border) bg-linear-145 from-[#ebeff4]/85 to-[#f5f5f6]/75 text-[#a6adbd] dark:border-[#494345] dark:from-[#42352e]/88 dark:to-[#28272a]/85 dark:text-[#b0b8c9]",
        )}
      >
        <ShieldTick className="size-7" />
      </div>
    </div>
  );
}
