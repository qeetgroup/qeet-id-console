import {
  BookOpenIcon,
  FileTextIcon,
  HeadphonesIcon,
  InfoIcon,
  LoaderCircleIcon,
  MailIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  UploadIcon,
} from "@qeetrix/icons";
import { Button, cn } from "@qeetrix/ui";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  useAcceptInvitation,
  useDeclineInvitation,
  useMyInvitations,
  usePasskeys,
} from "@/modules/authentication";
import { useMe } from "@/platform/auth/session";
import { toastError } from "@/platform/errors/error-toast";

import {
  DETAIL,
  FOCUS,
  ITEM_TITLE,
  SectionHeading,
  WelcomePanel,
} from "./no-workspace-onboarding-ui";

const SETUP_STEPS = ["organization", "authentication", "team"] as const;
type Readiness = "complete" | "pending" | "loading" | "unavailable";

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
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
          focusable="false"
        >
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

export function GettingStarted({ onStart }: { onStart?: () => void }) {
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
          {/* Always 0: this view mounts only before an organization exists. */}
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

export function AccountReadiness() {
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
  const account: Readiness = // a UX summary, not an auth decision; unknown data never turns green
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

export function HelpResources() {
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

export function PendingInvitations() {
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
                    onError: (err) => toastError(err),
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
                  accept.mutate(invite.id, { onError: (err) => toastError(err) });
                }}
              >
                {accept.isPending && (
                  <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
                )}
                {t("invites.accept")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </WelcomePanel>
  );
}
