import { QeetLogoMark } from "@qeetrix/ui/brand";

import { CreateOrgFlow } from "./create-org-flow";

interface OrgOnboardingProps {
  title?: string;
  subtitle?: string;
  /** Shown on the plan step (e.g. to cancel creating an additional org). */
  onCancel?: () => void;
  /** Where to go once a free/enterprise org settles (paid plans redirect to pay). */
  onDone?: () => void;
}

/**
 * Full-width onboarding surface that hosts the create-organization flow. Used
 * for first-run (a tenant-less user right after email verification) and for
 * creating an additional organization later.
 */
export function OrgOnboarding({
  title = "Set up your organization",
  subtitle = "Pick a plan to get started — you can change or cancel it anytime.",
  onCancel,
  onDone,
}: OrgOnboardingProps) {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 py-2">
      <header className="flex flex-col gap-3">
        <span className="grid size-12 place-items-center rounded-xl bg-primary/10 ring-1 ring-primary/15">
          <QeetLogoMark size={28} title="Qeet" />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Organization setup
          </p>
          <h1 className="mt-1 text-balance font-heading text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
            {subtitle}
          </p>
        </div>
      </header>

      <CreateOrgFlow onCancel={onCancel} onDone={onDone} />
    </section>
  );
}
