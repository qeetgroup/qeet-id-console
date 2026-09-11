import {
  ArrowRightIcon,
  BookOpenIcon,
  FileTextIcon,
  HeadphonesIcon,
  InfoIcon,
  KeyRoundIcon,
  LayersIcon,
  Loader2Icon,
  MailIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  UploadIcon,
} from "lucide-react";
import { Button, cn } from "@qeetrix/ui";
import { QeetLogoMark } from "@qeetrix/ui/brand";
import { Link } from "@tanstack/react-router";
import { type ComponentProps, type ReactNode, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  useAcceptInvitation,
  useDeclineInvitation,
  useMyInvitations,
  usePasskeys,
} from "@/modules/authentication";
import { useMe } from "@/platform/auth/session";
import { errorMessage } from "@/platform/errors/user-message";

import { OrganizationIllustration } from "./organization-illustration";

const FOUNDATIONS = [
  { id: "boundary", icon: ShieldCheckIcon },
  { id: "authentication", icon: KeyRoundIcon },
  { id: "audit", icon: FileTextIcon },
] as const;
const SETUP_STEPS = ["organization", "authentication", "team"] as const;
type Readiness = "complete" | "pending" | "loading" | "unavailable";

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--welcome-orange) disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none";
const DETAIL = "font-sans text-[11px] leading-normal text-(--welcome-muted)";
const ITEM_TITLE = "m-0 font-sans text-[11px] font-semibold leading-normal";
const ACTION =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-md border px-4 py-2 text-xs font-semibold leading-snug whitespace-nowrap no-underline transition-[background-color,border-color,box-shadow] duration-200 [&>svg]:size-4 @max-[920px]/welcome:px-3 @max-[920px]/welcome:text-[11px] @max-[760px]/welcome:min-h-11 @max-[480px]/welcome:w-full";
const FOOTER_LINK =
  "hover:text-(--welcome-text) hover:underline underline-offset-3 @max-[760px]/welcome:inline-flex @max-[760px]/welcome:min-h-11 @max-[760px]/welcome:items-center";
const ICON_TONES = {
  brand: "bg-(--welcome-orange-soft) text-(--welcome-orange)",
  success: "bg-(--welcome-green-soft) text-(--welcome-green)",
  info: "bg-(--welcome-blue-soft) text-(--welcome-blue)",
  neutral: "bg-(--welcome-soft) text-(--welcome-muted)",
};

function WelcomePanel({ className, ...props }: ComponentProps<"section">) {
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

function WelcomeIcon({
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

function SectionHeading({
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

function RocketIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path
        d="M8 15c-2-6 5-12 12-11 1 7-5 14-11 12l-1-1Zm0-5-4 1-2 5 5-1m6 1-1 5 5-2 1-4M6 18l-3 3m2-5-3 3m6 0-3 3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="15" cy="9" r="2" />
    </svg>
  );
}

function ReadinessMark({ state }: { state: Readiness }) {
  return (
    <span
      className={cn(
        "grid size-7.5 shrink-0 place-items-center rounded-full [&>svg]:size-4.5",
        state === "complete"
          ? "bg-(--welcome-green-soft) text-(--welcome-green)"
          : "bg-(--welcome-border) text-(--welcome-muted)",
      )}
      data-state={state}
      aria-hidden="true"
    >
      {state === "complete" ? (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m5.5 10 3 3 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : state === "loading" ? (
        <span className="h-0.75 w-3.5 rounded-full bg-current" />
      ) : (
        <InfoIcon />
      )}
    </span>
  );
}

function GettingStarted({ onStart }: { onStart?: () => void }) {
  const { t } = useTranslation("dashboard");
  const [expanded, setExpanded] = useState(true);
  const stepsId = useId();

  return (
    <WelcomePanel
      className="px-4.5 pt-3.5 pb-4 @max-[480px]/welcome:px-3.5"
      aria-labelledby={`${stepsId}-title`}
    >
      <div className="flex items-center gap-5 @max-[760px]/welcome:flex-wrap @max-[760px]/welcome:gap-3">
        <SectionHeading
          id={`${stepsId}-title`}
          icon={<RocketIcon />}
          title={t("welcome.checklist.title")}
          description={t("welcome.checklist.description")}
          className="@max-[760px]/welcome:max-w-[calc(100%-3.5rem)]"
        />
        <div className="ms-auto grid w-48 shrink-0 gap-1.5 text-[10px] text-(--welcome-muted) @max-[920px]/welcome:w-36 @max-[760px]/welcome:order-3 @max-[760px]/welcome:ms-14 @max-[760px]/welcome:w-[calc(100%-3.5rem)]">
          <span>
            {t("welcome.checklist.progress", { completed: 0, total: SETUP_STEPS.length })}
          </span>
          {/* This view is only mounted without a tenant. Organization setup has
              not begun; its real post-creation checklist lives in DashboardOverview. */}
          <progress
            className="h-1.75 w-full appearance-none overflow-clip rounded-full border-0 bg-(--welcome-progress) [&::-moz-progress-bar]:bg-(--welcome-orange) [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-(--welcome-progress) [&::-webkit-progress-value]:bg-(--welcome-orange)"
            max={SETUP_STEPS.length}
            value={0}
            aria-label={t("welcome.checklist.progressLabel")}
          />
        </div>
        <button
          type="button"
          className={cn(
            "group grid size-8 shrink-0 cursor-pointer place-items-center rounded-md border border-(--welcome-border) bg-(--welcome-soft) hover:bg-(--welcome-border) @max-[760px]/welcome:ms-auto @max-[760px]/welcome:size-11",
            FOCUS,
          )}
          aria-expanded={expanded}
          aria-controls={stepsId}
          aria-label={t(expanded ? "welcome.checklist.collapse" : "welcome.checklist.expand")}
          onClick={() => setExpanded((value) => !value)}
        >
          <svg
            className="size-4.5 transition-transform duration-200 group-aria-[expanded=false]:rotate-180 motion-reduce:transition-none"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="m5 12 5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <ol
        id={stepsId}
        className={cn(
          "mt-4.5 grid list-none grid-cols-3 gap-6 p-0 @max-[760px]/welcome:gap-3.5 @max-[480px]/welcome:grid-cols-1",
          !expanded && "hidden",
        )}
        hidden={!expanded}
      >
        {SETUP_STEPS.map((step, index) => (
          <li
            key={step}
            className="relative flex items-start gap-4 not-first:ps-6 not-first:before:absolute not-first:before:inset-y-2 not-first:before:inset-s-0 not-first:before:w-px not-first:before:bg-(--welcome-border) not-first:before:content-[''] @max-[760px]/welcome:gap-2.5 @max-[760px]/welcome:not-first:ps-0 @max-[760px]/welcome:before:hidden"
            aria-current={index === 0 ? "step" : undefined}
          >
            <span
              className="grid size-8.5 shrink-0 place-items-center rounded-full bg-linear-145 from-(--welcome-soft) to-(--welcome-border) text-[13px] font-semibold"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <div>
              <h3 className={cn(ITEM_TITLE, "mt-0.75")}>
                {index === 0 ? (
                  <button
                    type="button"
                    className={cn(
                      "cursor-pointer text-start hover:text-(--welcome-orange) @max-[480px]/welcome:min-h-11",
                      FOCUS,
                    )}
                    onClick={onStart}
                    disabled={!onStart}
                  >
                    {t(`welcome.checklist.steps.${step}.title`)}
                  </button>
                ) : (
                  t(`welcome.checklist.steps.${step}.title`)
                )}
              </h3>
              <p className={cn("mt-1.25 max-w-56 @max-[480px]/welcome:max-w-none", DETAIL)}>
                {t(`welcome.checklist.steps.${step}.description`)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </WelcomePanel>
  );
}

function AccountReadiness() {
  const { t } = useTranslation("dashboard");
  const me = useMe();
  const passkeys = usePasskeys();
  const titleId = useId();
  const identity: Readiness = me.isError
    ? "unavailable"
    : !me.data
      ? "loading"
      : me.data.email_verified_at
        ? "complete"
        : "pending";
  const passkey: Readiness = passkeys.isError
    ? "unavailable"
    : !passkeys.data
      ? "loading"
      : passkeys.data.items.length > 0
        ? "complete"
        : "pending";
  // A summary of confirmed email + an enrolled passkey, not a security guarantee
  // or a client-side authorization decision. Unknown/error data never turns green.
  const account: Readiness =
    identity === "unavailable" || passkey === "unavailable"
      ? "unavailable"
      : identity === "loading" || passkey === "loading"
        ? "loading"
        : identity === "complete" && passkey === "complete" && me.data?.status === "active"
          ? "complete"
          : "pending";
  const statusRows = [
    { id: "identity", state: identity },
    { id: "passkey", state: passkey },
    { id: "account", state: account },
  ] as const;

  return (
    <WelcomePanel className="min-h-41.5 pt-3.5 pb-3 dark:min-h-42.5" aria-labelledby={titleId}>
      <SectionHeading
        id={titleId}
        icon={<ShieldCheckIcon aria-hidden="true" />}
        tone={account === "complete" ? "success" : "neutral"}
        title={t(`welcome.account.${account}.title`)}
        description={t(`welcome.account.${account}.description`)}
      />
      <ul
        className="mt-3 grid min-h-20 list-none grid-cols-3 items-center gap-3 rounded-lg border border-(--welcome-border) bg-(--welcome-soft)/60 px-4 py-3.5 @max-[920px]/welcome:gap-2.5 @max-[920px]/welcome:px-3 @max-[480px]/welcome:grid-cols-1 @max-[480px]/welcome:gap-3.5"
        aria-live="polite"
        aria-busy={account === "loading"}
      >
        {statusRows.map(({ id, state }) => (
          <li
            key={id}
            data-state={state}
            className="flex min-w-0 items-center gap-3.5 @max-[920px]/welcome:gap-2"
          >
            <ReadinessMark state={state} />
            <div>
              <h3 className={cn(ITEM_TITLE, "text-[10px]")}>
                {t(`welcome.account.rows.${id}.${state === "complete" ? "complete" : "label"}`)}
              </h3>
              <p className="mt-0.5 text-[10px] leading-[1.45] text-(--welcome-muted)">
                {t(
                  state === "complete"
                    ? `welcome.account.rows.${id}.description`
                    : `welcome.account.status.${state}`,
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {account === "unavailable" && (
        <button
          className={cn(
            "mt-2.5 flex min-h-11 cursor-pointer items-center gap-1.5 text-xs [&>svg]:size-3.5",
            FOCUS,
          )}
          type="button"
          disabled={me.isFetching || passkeys.isFetching}
          onClick={() => {
            void me.refetch();
            void passkeys.refetch();
          }}
        >
          <RefreshCwIcon aria-hidden="true" /> {t("welcome.account.retry")}
        </button>
      )}
    </WelcomePanel>
  );
}

function HelpResources() {
  const { t } = useTranslation("dashboard");
  const titleId = useId();
  const resources = [
    { id: "docs", href: "https://docs.id.qeet.in", icon: FileTextIcon },
    { id: "support", href: "https://id.qeet.in/contact", icon: HeadphonesIcon },
  ] as const;

  return (
    <WelcomePanel className="min-h-41.5 pt-3.5 pb-3 dark:min-h-42.5" aria-labelledby={titleId}>
      <SectionHeading
        id={titleId}
        icon={<BookOpenIcon aria-hidden="true" />}
        tone="info"
        title={t("welcome.help.title")}
        description={t("welcome.help.description")}
      />
      <ul className="mt-3 grid list-none gap-1.75 p-0">
        {resources.map(({ id, href, icon: Icon }) => (
          <li key={id}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex min-h-10 items-center gap-3.5 rounded-md border border-(--welcome-border) px-2 py-1.25 no-underline transition-colors hover:border-(--welcome-blue)/40 hover:bg-(--welcome-soft) @max-[760px]/welcome:min-h-11",
                FOCUS,
              )}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-md border border-(--welcome-border) text-(--welcome-muted)">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="grid min-w-0 gap-px text-[10px] leading-[1.35]">
                <strong className="font-semibold">{t(`welcome.help.${id}.title`)}</strong>
                <span className="text-(--welcome-muted)">
                  {t(`welcome.help.${id}.description`)}
                </span>
              </span>
              <span className="ms-auto grid size-5.5 shrink-0 place-items-center rounded border border-(--welcome-border) text-(--welcome-muted)">
                <UploadIcon className="size-3.25" aria-hidden="true" />
              </span>
              <span className="sr-only">{t("welcome.help.newTab")}</span>
            </a>
          </li>
        ))}
      </ul>
    </WelcomePanel>
  );
}

function PendingInvitations() {
  const { t } = useTranslation("dashboard");
  const invitesQ = useMyInvitations();
  const accept = useAcceptInvitation();
  const decline = useDeclineInvitation();
  const invites = invitesQ.data?.items ?? [];
  const busy = accept.isPending || decline.isPending;
  const titleId = useId();
  if (invites.length === 0) return null;

  return (
    <WelcomePanel aria-labelledby={titleId}>
      <SectionHeading
        id={titleId}
        icon={<MailIcon aria-hidden="true" />}
        title={t("invites.title")}
        description={t("invites.description")}
      />
      <ul className="mt-3.5 list-none p-0">
        {invites.map((invite) => (
          <li
            key={invite.id}
            className="flex flex-wrap items-center justify-between gap-3 not-first:mt-3 not-first:border-t not-first:border-(--welcome-border) not-first:pt-3"
          >
            <div>
              <h3 className={ITEM_TITLE}>{invite.tenant_name}</h3>
              <p className="text-xs wrap-anywhere text-(--welcome-muted)">
                {t("invites.invitedAs", { email: invite.email })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={FOCUS}
                disabled={busy}
                onClick={() => {
                  if (busy) return;
                  decline.mutate(invite.id, {
                    onSuccess: () => toast.message(t("invites.dismissed")),
                    onError: (err) => toast.error(errorMessage(err)),
                  });
                }}
              >
                {t("invites.decline")}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy}
                className={FOCUS}
                onClick={() => {
                  if (busy) return;
                  accept.mutate(invite.id, { onError: (err) => toast.error(errorMessage(err)) });
                }}
              >
                {accept.isPending && <Loader2Icon className="animate-spin" aria-hidden="true" />}
                {t("invites.accept")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </WelcomePanel>
  );
}

/** Only the tenant-less dashboard center. AppSidebar, ConsoleHeader and the
 *  existing organization creation / checkout routes remain outside this view. */
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
                <QeetLogoMark size={13} aria-hidden="true" /> {t("welcome.eyebrow")}
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
