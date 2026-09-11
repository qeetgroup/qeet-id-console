// Export control for the identity timeline header. Downloads the currently
// loaded events as CSV or JSON (see timeline-export.ts).

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@qeetrix/ui";
import { ChevronDownIcon, DownloadIcon, FileJsonIcon, SheetIcon } from "lucide-react";

import type { ActivityEvent } from "@/modules/activity";
import { exportTimelineEvents } from "../timeline-export";

export function TimelineExportMenu({
  events,
  userId,
  disabled,
}: {
  events: ActivityEvent[];
  userId: string;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" disabled={disabled || events.length === 0}>
            <DownloadIcon className="size-3.5" aria-hidden="true" />
            Export
            <ChevronDownIcon className="size-3.5 opacity-70" aria-hidden="true" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportTimelineEvents(events, "csv", userId)}>
          <SheetIcon className="size-3.5" aria-hidden="true" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportTimelineEvents(events, "json", userId)}>
          <FileJsonIcon className="size-3.5" aria-hidden="true" />
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
