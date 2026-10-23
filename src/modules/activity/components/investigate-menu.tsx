import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useCopyToClipboard,
} from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import {
  ClipboardIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  FunnelIcon,
  PanelRightOpenIcon,
} from "@qeetrix/icons";
import type { ReactElement } from "react";
import { toast } from "sonner";

import type { ActivitySearch } from "../activity-search";
import type { ActivityEvent } from "../types/activity.types";
import i18n, { type TranslationKey } from "@/i18n";

type InvestigateMenuProps = {
  event: ActivityEvent;
  onFilter?: (patch: Partial<ActivitySearch>) => void; // Patches the feed's URL search
  onViewDetails?: () => void;
  align?: "start" | "center" | "end";
  trigger?: ReactElement; // Replaces the default ghost "⋯" icon button
};

const targetIs = (event: ActivityEvent, ...types: string[]) =>
  !!event.target?.type && types.includes(event.target.type.toLowerCase());

/**
 * Renders an event's "⋯" menu: links to its actor and to a target that has a detail page
 * (group, webhook, OIDC client), the audit log, feed filters, and copy-ID actions.
 */
export function InvestigateMenu({
  event,
  onFilter,
  onViewDetails,
  align = "end",
  trigger,
}: InvestigateMenuProps) {
  const { copy } = useCopyToClipboard();
  const doCopy = (value: string, copiedKey: TranslationKey) => {
    copy(value);
    toast.success(i18n.t(copiedKey));
  };

  const actorId = event.actor?.id;
  const targetId = event.target?.id;
  // The audit log filters by actor, not request_id; request correlation is the drawer's
  // Related tab.
  const auditSearch = actorId ? { actor_user_id: actorId } : {};

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          trigger ?? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7 text-muted-foreground"
              aria-label={i18n.t("activity:investigateMenu.investigateEvent")}
              onClick={(e) => e.stopPropagation()}
            >
              <EllipsisIcon className="size-4" aria-hidden="true" />
            </Button>
          )
        }
      />
      <DropdownMenuContent align={align} sideOffset={4} className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{i18n.t("activity:investigateMenu.investigate")}</DropdownMenuLabel>
          {onViewDetails && (
            <DropdownMenuItem onClick={onViewDetails}>
              <PanelRightOpenIcon className="size-3.5" aria-hidden="true" />
              {i18n.t("activity:investigateMenu.viewDetails")}
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        {actorId && (
          <>
            <DropdownMenuItem render={<Link to="/users/$userId" params={{ userId: actorId }} />}>
              <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
              {i18n.t("activity:investigateMenu.viewUser")}
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<Link to="/users/$userId/timeline" params={{ userId: actorId }} />}
            >
              <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
              {i18n.t("activity:investigateMenu.viewUserTimeline")}
            </DropdownMenuItem>
          </>
        )}
        {targetIs(event, "group") && targetId && (
          <DropdownMenuItem render={<Link to="/groups/$groupId" params={{ groupId: targetId }} />}>
            <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
            {i18n.t("activity:investigateMenu.viewGroup")}
          </DropdownMenuItem>
        )}
        {targetIs(event, "webhook") && targetId && (
          <DropdownMenuItem
            render={<Link to="/developer/webhooks/$id" params={{ id: targetId }} />}
          >
            <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
            {i18n.t("activity:investigateMenu.viewWebhook")}
          </DropdownMenuItem>
        )}
        {targetIs(event, "oidc_client", "client", "application") && targetId && (
          <DropdownMenuItem
            render={<Link to="/auth/connections/oidc/$clientId" params={{ clientId: targetId }} />}
          >
            <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
            {i18n.t("activity:investigateMenu.viewOidcClient")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem render={<Link to="/security/audit-logs" search={auditSearch} />}>
          <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
          {i18n.t("activity:investigateMenu.correlateInAuditLog")}
        </DropdownMenuItem>

        {onFilter && (
          <>
            <DropdownMenuSeparator />
            {(actorId || event.actor?.name) && (
              <DropdownMenuItem onClick={() => onFilter({ actor: actorId ?? event.actor?.name })}>
                <FunnelIcon className="size-3.5" aria-hidden="true" />
                {i18n.t("activity:investigateMenu.filterByThisActor")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onFilter({ type: event.type })}>
              <FunnelIcon className="size-3.5" aria-hidden="true" />
              {i18n.t("activity:investigateMenu.filterByEventType")}
            </DropdownMenuItem>
            {event.ip && (
              <DropdownMenuItem onClick={() => onFilter({ ip: event.ip })}>
                <FunnelIcon className="size-3.5" aria-hidden="true" />
                {i18n.t("activity:investigateMenu.filterByThisIp")}
              </DropdownMenuItem>
            )}
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => doCopy(event.id, "activity:investigateMenu.copied.eventId")}
        >
          <ClipboardIcon className="size-3.5" aria-hidden="true" />
          {i18n.t("activity:investigateMenu.copyEventId")}
        </DropdownMenuItem>
        {event.request_id && (
          <DropdownMenuItem
            onClick={() =>
              doCopy(event.request_id as string, "activity:investigateMenu.copied.requestId")
            }
          >
            <ClipboardIcon className="size-3.5" aria-hidden="true" />
            {i18n.t("activity:investigateMenu.copyRequestId")}
          </DropdownMenuItem>
        )}
        {actorId && (
          <DropdownMenuItem
            onClick={() => doCopy(actorId, "activity:investigateMenu.copied.actorId")}
          >
            <ClipboardIcon className="size-3.5" aria-hidden="true" />
            {i18n.t("activity:investigateMenu.copyActorId")}
          </DropdownMenuItem>
        )}
        {event.ip && (
          <DropdownMenuItem
            onClick={() => doCopy(event.ip as string, "activity:investigateMenu.copied.ip")}
          >
            <ClipboardIcon className="size-3.5" aria-hidden="true" />
            {i18n.t("activity:investigateMenu.copyIpAddress")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
