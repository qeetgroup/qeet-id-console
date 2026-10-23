import {
  ArrowRightIcon,
  FileTextIcon,
  KeyRoundIcon,
  LayersIcon,
  PlusIcon,
  ShieldCheckIcon,
} from "@qeetrix/icons";
import { Button, cn } from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { QeetMark } from "@/shared/components/qeet-mark";

import { OrganizationIllustration } from "./organization-illustration";
import {
  AccountReadiness,
  GettingStarted,
  HelpResources,
  PendingInvitations,
} from "./no-workspace-onboarding-panels";
import { FOCUS, ITEM_TITLE, WelcomeIcon } from "./no-workspace-onboarding-ui";

const FOUNDATIONS = [
  { id: "boundary", icon: ShieldCheckIcon },
  { id: "authentication", icon: KeyRoundIcon },
  { id: "audit", icon: FileTextIcon },
] as const;

const ACTION =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-md border px-4 py-2 text-xs font-semibold leading-snug whitespace-nowrap no-underline transition-[background-color,border-color,box-shadow] duration-200 [&>svg]:size-4 @max-[920px]/welcome:px-3 @max-[920px]/welcome:text-[11px] @max-[760px]/welcome:min-h-11 @max-[480px]/welcome:w-full";
const FOOTER_LINK =
  "hover:text-(--welcome-text) hover:underline underline-offset-3 @max-[760px]/welcome:inline-flex @max-[760px]/welcome:min-h-11 @max-[760px]/welcome:items-center";

/**
 * Renders the dashboard centre for a user with no organization yet; the sidebar, header and
 * organization-creation routes stay outside it.
 */
export function NoWorkspaceOnboarding({ onStart }: { onStart?: () => void }) {
  const { t } = useTranslation("dashboard");
  const id = useId();

  return (
    <div
      data-slot="workspace-welcome"
      className={cn(
        "@container/welcome -mx-1 -mt-4 -mb-2 flex min-w-0 flex-1 flex-col gap-4 font-sans text-(--welcome-text) antialiased sm:-mt-6 xl:-mx-3 xl:-mt-8 xl:-mb-4 dark:-mt-3 sm:dark:-mt-5 xl:dark:-mt-7",
        "[--welcome-text:#101827] [--welcome-muted:#64718a] [--welcome-border:#e7ecf3] [--welcome-surface:var(--card)] [--welcome-soft:var(--surface-subtle)] [--welcome-progress:#e9edf3]",
        "[--welcome-orange:#ed5706] [--welcome-orange-soft:#fff1e9] [--welcome-green:#12823d] [--welcome-green-soft:#e0f5e8] [--welcome-blue:#347ff0] [--welcome-blue-soft:#eef4ff] [--welcome-shadow:0_4px_20px_rgb(30_56_86/0.03)]",
        "dark:[--welcome-text:#f0f2f5] dark:[--welcome-muted:#b0bbce] dark:[--welcome-border:#29333c] dark:[--welcome-surface:#161d23] dark:[--welcome-soft:#192127] dark:[--welcome-progress:#343e49]",
        "dark:[--welcome-orange:#ff741b] dark:[--welcome-orange-soft:#30251e] dark:[--welcome-green:#78f5a5] dark:[--welcome-green-soft:#1d382b] dark:[--welcome-blue:#4393ff] dark:[--welcome-blue-soft:#1a2a40] dark:[--welcome-shadow:0_6px_22px_rgb(0_0_0/0.08)]",
      )}
    >
      <PendingInvitations />
      {/* Gutters share the console backdrop; only individual cards have a surface. */}
      <div
        data-slot="welcome-panels"
        className="flex min-w-0 flex-col gap-4 rounded-xl border border-transparent bg-transparent p-5 pb-0 shadow-none @max-[480px]/welcome:p-3 @max-[480px]/welcome:pb-0 dark:gap-3.5 dark:rounded-none dark:border-0 dark:bg-none dark:p-0 dark:shadow-none"
      >
        <section
          data-slot="welcome-hero"
          className={cn(
            "mb-1 grid min-h-69 grid-cols-1 items-center gap-5 pt-2 dark:mb-0 @min-[761px]/welcome:grid-cols-[minmax(0,1fr)_minmax(18.75rem,30%)] @min-[761px]/welcome:gap-6",
            "dark:min-h-76.5 dark:gap-5 dark:rounded-[10px] dark:border dark:border-(--welcome-border) dark:bg-(--welcome-surface) dark:p-4 dark:shadow-(--welcome-shadow)",
            "dark:bg-[radial-gradient(ellipse_at_55%_45%,rgb(211_87_27/0.06),transparent_48%),linear-gradient(120deg,rgb(255_255_255/0.015),transparent_68%)]",
            "@min-[481px]/welcome:dark:pt-5 @min-[481px]/welcome:dark:pe-4.5 @min-[481px]/welcome:dark:ps-8",
          )}
          aria-labelledby={`${id}-title`}
        >
          <div className="relative isolate min-w-0 px-2.5 py-5 dark:px-0">
            <div className="relative z-1 max-w-[min(27.5rem,calc(100%-10rem))] @max-[920px]/welcome:max-w-[calc(100%-7.25rem)] @max-[760px]/welcome:max-w-[min(29rem,calc(100%-10rem))] @max-[480px]/welcome:max-w-none">
              <p className="m-0 flex items-center gap-0.5 text-xs font-medium leading-normal text-(--welcome-muted)">
                <QeetMark height={13} /> {t("welcome.eyebrow")}
              </p>
              <h1
                id={`${id}-title`}
                className="mt-3.5 mb-2.5 font-sans text-[clamp(1.5rem,2.85cqw,1.8125rem)] leading-[1.2] font-bold tracking-[-0.045em]"
              >
                {t("noWorkspace.title")}
              </h1>
              <p className="m-0 text-[13px] leading-[1.65] text-(--welcome-muted)">
                {t("welcome.description")}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3.5 @max-[920px]/welcome:gap-2.5">
                <Button
                  className={cn(
                    ACTION,
                    "border-[#ee650e] bg-linear-105 from-[#f97707] via-[#d84900] via-35% to-[#e55700] text-white shadow-[inset_0_1px_0_rgb(255_204_134/0.2),0_3px_8px_rgb(211_75_0/0.08)] hover:shadow-[inset_0_1px_0_rgb(255_204_134/0.25),0_3px_16px_rgb(211_75_0/0.22)]",
                    FOCUS,
                  )}
                  type="button"
                  onClick={onStart}
                  disabled={!onStart}
                >
                  <PlusIcon aria-hidden="true" /> {t("noWorkspace.cta")}
                </Button>
                <Link
                  to="/account/security"
                  className={cn(
                    ACTION,
                    "border-(--welcome-border) bg-(--welcome-surface) text-(--welcome-text) shadow-xs hover:border-(--welcome-muted)/40 hover:bg-(--welcome-soft)",
                    FOCUS,
                  )}
                >
                  {t("welcome.reviewSecurity")} <ArrowRightIcon aria-hidden="true" />
                </Link>
              </div>
            </div>
            <OrganizationIllustration />
          </div>
          <aside
            className="min-w-0 rounded-lg border border-(--welcome-border) bg-(--welcome-surface) px-4 pt-4 pb-2 shadow-(--welcome-shadow)"
            aria-labelledby={`${id}-foundations`}
          >
            <h2
              id={`${id}-foundations`}
              className="m-0 mb-2 flex items-center gap-3.5 font-sans text-[13px] font-semibold leading-normal"
            >
              <LayersIcon className="size-5 shrink-0" aria-hidden="true" />
              {t("welcome.foundations.title")}
            </h2>
            <ul className="m-0 list-none p-0 @max-[760px]/welcome:grid @max-[760px]/welcome:grid-cols-3 @max-[760px]/welcome:gap-4 @max-[480px]/welcome:grid-cols-1">
              {FOUNDATIONS.map(({ id: foundation, icon: Icon }) => (
                <li
                  key={foundation}
                  className="flex items-start gap-4 py-2.5 not-first:border-t not-first:border-(--welcome-border)/65 @max-[760px]/welcome:flex-col @max-[760px]/welcome:gap-2.5 @max-[760px]/welcome:not-first:border-0 @max-[480px]/welcome:flex-row"
                >
                  <WelcomeIcon className="size-9">
                    <Icon aria-hidden="true" />
                  </WelcomeIcon>
                  <div className="min-w-0">
                    <h3 className={ITEM_TITLE}>{t(`welcome.foundations.${foundation}.title`)}</h3>
                    <p className="mt-0.75 text-[10.5px] leading-[1.45] tracking-[-0.01em] text-(--welcome-muted)">
                      {t(`welcome.foundations.${foundation}.description`)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </section>
        <GettingStarted onStart={onStart} />
        <div className="grid grid-cols-[minmax(0,1.34fr)_minmax(0,1fr)] gap-4 @max-[760px]/welcome:grid-cols-1">
          <AccountReadiness />
          <HelpResources />
        </div>
      </div>
      <footer className="mt-auto flex items-center justify-between gap-4 py-0.5 text-[9px] leading-normal text-(--welcome-muted) @max-[760px]/welcome:flex-wrap @max-[760px]/welcome:gap-2">
        <p className="m-0 flex flex-wrap items-center gap-4">
          <strong className="text-[10px] font-medium text-(--welcome-text)">Qeet ID</strong>
          <span className="border-s border-(--welcome-border) ps-3.5">
            {t("welcome.footer.tagline")}
          </span>
        </p>
        <nav
          className="flex flex-wrap items-center gap-4"
          aria-label={t("welcome.footer.navigation")}
        >
          <a
            className={cn(FOOTER_LINK, FOCUS)}
            href="https://id.qeet.in/status"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("welcome.footer.status")}
          </a>
          <a
            className={cn(FOOTER_LINK, FOCUS)}
            href="https://docs.id.qeet.in"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("welcome.footer.docs")}
          </a>
          <a
            className={cn(FOOTER_LINK, FOCUS)}
            href="https://id.qeet.in/legal/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("welcome.footer.privacy")}
          </a>
          <a
            className={cn(FOOTER_LINK, FOCUS)}
            href="https://id.qeet.in/legal/terms"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("welcome.footer.terms")}
          </a>
        </nav>
      </footer>
    </div>
  );
}
