import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CreditCardIcon,
  FileTextIcon,
  GlobeIcon,
  LockIcon,
  ShieldCheckIcon,
  UploadIcon,
  UsersIcon,
} from "lucide-react";
import { cn } from "@qeetrix/ui";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { SetupWindowArtwork } from "./setup-artwork";
import { SETUP_FOCUS, SETUP_PANEL } from "./setup-styles";

function BulbIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path
        d="M8 15a7 7 0 1 1 8 0c-1 .7-1.5 1.5-1.5 3h-5c0-1.5-.5-2.3-1.5-3ZM9.5 18v2h5v-2m-4 4h3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RocketIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path
        d="M8 15c-2-6 5-12 12-11 1 7-5 14-11 12l-1-1Zm0-5-4 1-2 5 5-1m6 1-1 5 5-2 1-4M6 18l-3 3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="15" cy="9" r="2" />
    </svg>
  );
}

/** Educational context only; no fabricated security certification or setup state. */
export function SetupGuidance({ kind }: { kind: "profile" | "name" }) {
  const { t } = useTranslation("dashboard");
  const titleId = useId();
  const tips = [
    { id: "name", icon: UsersIcon },
    { id: "region", icon: GlobeIcon },
    { id: "branding", icon: FileTextIcon },
  ] as const;

  return (
    <aside
      aria-labelledby={titleId}
      className={cn(
        SETUP_PANEL,
        "relative isolate flex flex-col overflow-clip bg-linear-135 from-orange-50/65 to-(--setup-surface) p-5 dark:from-[#302019]/75 dark:to-(--setup-surface)",
        "before:pointer-events-none before:absolute before:-top-18 before:right-9 before:-z-1 before:size-28 before:rounded-full before:bg-orange-100/35 before:content-[''] dark:before:bg-orange-600/10",
      )}
    >
      <span className="mb-3 grid size-10 place-items-center rounded-xl bg-orange-100/70 text-(--setup-accent) dark:border dark:border-orange-500/15 dark:bg-orange-900/25 [&>svg]:size-5.5">
        <BulbIcon />
      </span>
      <h2 id={titleId} className="font-sans text-[15px] font-semibold leading-5">
        {kind === "profile" ? (
          t("setup.guidance.profileTitle")
        ) : (
          <>
            <span className="dark:hidden">{t("setup.guidance.organizationTitle")}</span>
            <span className="hidden dark:inline">{t("setup.guidance.profileTitle")}</span>
          </>
        )}
      </h2>
      <p className="mt-1.5 text-xs leading-normal text-(--setup-muted)">
        {kind === "profile" ? (
          t("setup.guidance.profileIntro")
        ) : (
          <>
            <span className="dark:hidden">{t("setup.guidance.organizationIntro")}</span>
            <span className="hidden dark:inline">{t("setup.guidance.organizationIntroDark")}</span>
          </>
        )}
      </p>

      {kind === "profile" ? (
        <>
          <ul className="mt-4 grid list-none gap-2 p-0 text-xs leading-4 text-(--setup-muted)">
            {["checklist", "integrations", "dashboard", "resources"].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="shrink-0 text-(--setup-accent)">
                  <CheckCircle2Icon className="size-4" aria-hidden="true" />
                </span>
                {t(`setup.guidance.benefits.${item}`)}
              </li>
            ))}
          </ul>
          <div className="mt-5 border-t border-(--setup-border) pt-4">
            <h3 className="font-sans text-xs font-semibold">{t("setup.guidance.changeTitle")}</h3>
            <p className="mt-1.5 text-xs leading-normal text-(--setup-muted)">
              {t("setup.guidance.changeDescription")}
            </p>
          </div>
        </>
      ) : (
        <>
          <ul className="mt-3 hidden list-none gap-1.5 p-0 text-[11px] leading-4 text-(--setup-muted) dark:grid">
            {["workspace", "region", "defaults", "identity"].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="shrink-0 text-(--setup-accent)">
                  <CheckCircle2Icon className="size-3.5" aria-hidden="true" />
                </span>
                {t(`setup.guidance.organizationBenefits.${item}`)}
              </li>
            ))}
          </ul>
          <h3 className="mt-3 hidden border-t border-(--setup-border) pt-3 font-sans text-xs font-semibold dark:block">
            {t("setup.guidance.tipsTitle")}
          </h3>
          <ul className="mt-4 grid list-none gap-5 p-0 dark:mt-3 dark:gap-3">
            {tips.map(({ id, icon: Icon }) => (
              <li key={id} className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-orange-50 text-(--setup-accent) dark:size-6 dark:bg-transparent dark:text-(--setup-muted)">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-sans text-xs font-semibold">
                    {t(`setup.guidance.tips.${id}.title`)}
                  </h3>
                  <p className="mt-1 text-[11px] leading-[1.45] text-(--setup-muted) dark:text-[10px]">
                    {t(`setup.guidance.tips.${id}.description`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-auto flex min-w-0 items-end gap-1 pt-3">
        <SetupWindowArtwork
          className={cn(
            "h-32 min-w-0 flex-1 [--setup-window-scale:0.85]",
            kind === "name" && "dark:h-24 dark:[--setup-window-scale:0.68]",
          )}
        />
        <p className="w-27 shrink-0 pb-1 text-right text-[9px] leading-4 text-(--setup-muted)">
          <span className="italic">{t("setup.guidance.quote")}</span>
          <span className="mt-2 block">{t("setup.guidance.team")}</span>
        </p>
      </div>
    </aside>
  );
}

export function SetupPlanNotes() {
  const { t } = useTranslation("dashboard");
  const nextSteps = [
    { id: "plan", icon: CreditCardIcon },
    { id: "details", icon: FileTextIcon },
    { id: "launch", icon: UsersIcon },
  ] as const;
  const protections = [
    { id: "payments", icon: LockIcon },
    { id: "invoices", icon: FileTextIcon },
    { id: "control", icon: ShieldCheckIcon },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-3 @min-[720px]/setup:grid-cols-[1.4fr_1fr]">
      <section className={cn(SETUP_PANEL, "p-4")} aria-labelledby="setup-next-title">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-100/70 text-(--setup-accent) dark:bg-orange-900/20 [&>svg]:size-6">
            <RocketIcon />
          </span>
          <div>
            <h2 id="setup-next-title" className="font-sans text-[13px] font-semibold">
              {t("setup.notes.nextTitle")}
            </h2>
            <p className="mt-1 text-[11px] text-(--setup-muted)">
              {t("setup.notes.nextDescription")}
            </p>
          </div>
        </div>
        <ol className="mt-4 flex list-none gap-3 p-0 @max-[450px]/setup:flex-col">
          {nextSteps.map(({ id, icon: Icon }, index) => (
            <li key={id} className="flex min-w-0 flex-1 items-start gap-2">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border border-(--setup-border) bg-(--setup-soft) text-xs",
                  index === 0 &&
                    "border-orange-400/60 bg-orange-100/50 text-(--setup-accent) dark:bg-orange-950/40",
                )}
              >
                <Icon className="size-3.5 dark:hidden" aria-hidden="true" />
                <span className="hidden dark:inline">{index + 1}</span>
              </span>
              <div>
                <h3 className="font-sans text-[11px] font-medium">
                  {t(`setup.notes.next.${id}.title`)}
                </h3>
                <p className="mt-1 text-[10px] leading-4 text-(--setup-muted)">
                  {t(`setup.notes.next.${id}.description`)}
                </p>
              </div>
              {index < nextSteps.length - 1 && (
                <ArrowRightIcon
                  className="mt-2 size-3 shrink-0 text-(--setup-muted) @max-[450px]/setup:hidden"
                  aria-hidden="true"
                />
              )}
            </li>
          ))}
        </ol>
      </section>
      <section
        className={cn(SETUP_PANEL, "flex flex-col p-4")}
        aria-labelledby="setup-security-title"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-(--setup-soft)">
            <ShieldCheckIcon className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h2 id="setup-security-title" className="font-sans text-[13px] font-semibold">
              {t("setup.notes.securityTitle")}
            </h2>
            <p className="mt-1 text-[11px] text-(--setup-muted)">
              {t("setup.notes.securityDescription")}
            </p>
          </div>
          <a
            href="https://id.qeet.in/security"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("setup.notes.learnMore")}
            className={cn("ms-auto rounded p-1 text-(--setup-muted)", SETUP_FOCUS)}
          >
            <UploadIcon className="size-3.5" aria-hidden="true" />
          </a>
        </div>
        <ul className="mt-auto grid list-none grid-cols-3 gap-2 p-0 pt-5">
          {protections.map(({ id, icon: Icon }) => (
            <li
              key={id}
              className="flex min-w-0 items-start gap-2 text-[10px] leading-4 text-(--setup-muted)"
            >
              <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{t(`setup.notes.protections.${id}`)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
