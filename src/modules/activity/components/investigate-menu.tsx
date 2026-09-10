import { Clipboard, ExportRight, Filter, More, SidebarLeft } from "@qeetrix/icons";
// Investigate menu — the per-event "⋯" action menu that turns an activity row
// into an investigation hub: jump to the related entity, pivot the feed to a
// facet, or copy correlation IDs. Deep-links only to routes that actually exist
// ($id detail pages for user/group/webhook/oidc); other resources fall back to
// the audit log. Filter actions patch the URL search via onFilter.

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
import type { ReactElement } from "react";
import { toast } from "sonner";

import type { ActivitySearch } from "../activity-search";
import type { ActivityEvent } from "../types/activity.types";

type InvestigateMenuProps = {
  event: ActivityEvent;
  /** Apply a filter patch to the feed (URL search params). */
  onFilter?: (patch: Partial<ActivitySearch>) => void;
  /** Open the details drawer for this event. */
  onViewDetails?: () => void;
  align?: "start" | "center" | "end";
  /** Override the trigger; defaults to a ghost "⋯" icon button. */
  trigger?: ReactElement;
};

const targetIs = (event: ActivityEvent, ...types: string[]) =>
  !!event.target?.type && types.includes(event.target.type.toLowerCase());

export function InvestigateMenu({
  event,
  onFilter,
  onViewDetails,
  align = "end",
  trigger,
}: InvestigateMenuProps) {
  const { copy } = useCopyToClipboard();
  const doCopy = (value: string, label: string) => {
    copy(value);
    toast.success(`${label} copied`);
  };

  const actorId = event.actor?.id;
  const targetId = event.target?.id;
  // The audit Reader filters by actor (not request_id); request_id correlation
  // lives in the drawer's Related tab. Pivot the audit log to this actor.
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
              aria-label="Investigate event"
              onClick={(e) => e.stopPropagation()}
            >
              <More className="size-4" aria-hidden="true" />
            </Button>
          )
        }
      />
      <DropdownMenuContent align={align} sideOffset={4} className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Investigate</DropdownMenuLabel>
          {onViewDetails && (
            <DropdownMenuItem onClick={onViewDetails}>
              <SidebarLeft className="size-3.5" aria-hidden="true" />
              View details
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        {actorId && (
          <>
            <DropdownMenuItem render={<Link to="/users/$userId" params={{ userId: actorId }} />}>
              <ExportRight className="size-3.5" aria-hidden="true" />
              View user
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<Link to="/users/$userId/timeline" params={{ userId: actorId }} />}
            >
              <ExportRight className="size-3.5" aria-hidden="true" />
              View user timeline
            </DropdownMenuItem>
          </>
        )}
        {targetIs(event, "group") && targetId && (
          <DropdownMenuItem render={<Link to="/groups/$groupId" params={{ groupId: targetId }} />}>
            <ExportRight className="size-3.5" aria-hidden="true" />
            View group
          </DropdownMenuItem>
        )}
        {targetIs(event, "webhook") && targetId && (
          <DropdownMenuItem
            render={<Link to="/developer/webhooks/$id" params={{ id: targetId }} />}
          >
            <ExportRight className="size-3.5" aria-hidden="true" />
            View webhook
          </DropdownMenuItem>
        )}
        {targetIs(event, "oidc_client", "client", "application") && targetId && (
          <DropdownMenuItem
            render={<Link to="/auth/connections/oidc/$clientId" params={{ clientId: targetId }} />}
          >
            <ExportRight className="size-3.5" aria-hidden="true" />
            View OIDC client
          </DropdownMenuItem>
        )}
        <DropdownMenuItem render={<Link to="/security/audit-logs" search={auditSearch} />}>
          <ExportRight className="size-3.5" aria-hidden="true" />
          Correlate in audit log
        </DropdownMenuItem>

        {onFilter && (
          <>
            <DropdownMenuSeparator />
            {(actorId || event.actor?.name) && (
              <DropdownMenuItem onClick={() => onFilter({ actor: actorId ?? event.actor?.name })}>
                <Filter className="size-3.5" aria-hidden="true" />
                Filter by this actor
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onFilter({ type: event.type })}>
              <Filter className="size-3.5" aria-hidden="true" />
              Filter by event type
            </DropdownMenuItem>
            {event.ip && (
              <DropdownMenuItem onClick={() => onFilter({ ip: event.ip })}>
                <Filter className="size-3.5" aria-hidden="true" />
                Filter by this IP
              </DropdownMenuItem>
            )}
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => doCopy(event.id, "Event ID")}>
          <Clipboard className="size-3.5" aria-hidden="true" />
          Copy event ID
        </DropdownMenuItem>
        {event.request_id && (
          <DropdownMenuItem onClick={() => doCopy(event.request_id as string, "Request ID")}>
            <Clipboard className="size-3.5" aria-hidden="true" />
            Copy request ID
          </DropdownMenuItem>
        )}
        {actorId && (
          <DropdownMenuItem onClick={() => doCopy(actorId, "Actor ID")}>
            <Clipboard className="size-3.5" aria-hidden="true" />
            Copy actor ID
          </DropdownMenuItem>
        )}
        {event.ip && (
          <DropdownMenuItem onClick={() => doCopy(event.ip as string, "IP address")}>
            <Clipboard className="size-3.5" aria-hidden="true" />
            Copy IP address
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
