import { Button, buttonVariants } from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import { ClipboardIcon, ExternalLinkIcon, ShieldOffIcon, UserXIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import type { ActivityEvent } from "@/modules/activity";
import { useUserActions } from "@/modules/users";
import { useCapabilities } from "@/platform/security/capability-provider";
import { SectionHeading } from "./timeline-details-drawer-fields";

/**
 * Renders the drawer's quick actions: links to the user, session, organization and audit log,
 * copy buttons, and Reset MFA and Suspend user, which show only with user.write.
 */
export function TimelineQuickActions({
  event,
  userId,
}: {
  event: ActivityEvent;
  userId: string; // The timeline's user, whom the actions act on
}) {
  const { t } = useTranslation("timeline");
  const access = useCapabilities();
  const canWriteUsers = access.can("user.write");
  const actions = useUserActions();

  const sessionId =
    typeof event.metadata?.session_id === "string" ? event.metadata.session_id : null;

  return (
    <section aria-label={t("timelineDetailsDrawer.quickActions")}>
      <SectionHeading>{t("timelineDetailsDrawer.quickActions")}</SectionHeading>
      <div className="flex flex-wrap gap-2">
        {/* Navigation actions */}
        <Link
          to="/users/$userId"
          params={{ userId }}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
          {t("timelineDetailsDrawer.viewUser")}
        </Link>

        {sessionId && (
          <Link
            to="/security/sessions"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
            {t("timelineDetailsDrawer.viewSession")}
          </Link>
        )}

        {event.target?.type === "organization" && event.target.id && (
          <Link to="/organizations" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
            {t("timelineDetailsDrawer.openOrg")}
          </Link>
        )}

        <Link
          to="/security/audit-logs"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
          {t("timelineDetailsDrawer.viewAuditLog")}
        </Link>

        {/* Copy actions */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void navigator.clipboard.writeText(event.id)}
          aria-label={t("timelineDetailsDrawer.copyEventIdToClipboard")}
        >
          <ClipboardIcon className="size-3.5" aria-hidden="true" />
          {t("timelineDetailsDrawer.copyEventId")}
        </Button>

        {/* The visible text names these buttons, so voice control can say what it shows. */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void navigator.clipboard.writeText(JSON.stringify(event, null, 2))}
        >
          <ClipboardIcon className="size-3.5" aria-hidden="true" />
          {t("timelineDetailsDrawer.copyJson")}
        </Button>

        {/* Destructive actions — guarded by user.write capability */}
        {canWriteUsers && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={actions.pendingAction.resetMfa}
              onClick={() => actions.resetMfa({ id: userId })}
            >
              <ShieldOffIcon className="size-3.5" aria-hidden="true" />
              {actions.pendingAction.resetMfa
                ? t("timelineDetailsDrawer.resettingMfa")
                : t("timelineDetailsDrawer.resetMfa")}
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={actions.pendingAction.status}
              onClick={() => actions.suspend({ id: userId })}
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              <UserXIcon className="size-3.5" aria-hidden="true" />
              {actions.pendingAction.status
                ? t("timelineDetailsDrawer.suspending")
                : t("timelineDetailsDrawer.suspendUser")}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
