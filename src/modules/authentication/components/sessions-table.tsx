import { MonitorMobile, Shield } from "@qeetrix/icons";
import {
  Badge,
  Button,
  DataState,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import type { UseQueryResult } from "@tanstack/react-query";

import { formatIp } from "@/shared/utils/ip-format";
import type { Session } from "../api/sessions";

type SessionsTableProps = {
  query: UseQueryResult<{ items: Session[] }>;
  /** Marks the operator's current session as "This device" (self-view only). */
  currentSessionId?: string;
  /** Called when the user asks to revoke a session — the caller wires confirm/step-up. */
  onRevoke: (session: Session) => void;
  isRevoking?: boolean;
  emptyLabel?: string;
};

/**
 * Shared active-sessions table (device · IP · created · last seen · status ·
 * revoke). Presentational only — confirmation and step-up are the caller's
 * responsibility via `onRevoke` (see useSensitiveAction). Used by the security,
 * users, and account session views so they can't drift apart.
 */
export function SessionsTable({
  query,
  currentSessionId,
  onRevoke,
  isRevoking,
  emptyLabel = "No active sessions.",
}: SessionsTableProps) {
  const items = query.data?.items ?? [];
  return (
    <DataState
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      isEmpty={items.length === 0}
      emptyIcon={Shield}
      emptyTitle={emptyLabel}
      skeletonRows={3}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Device</TableHead>
            <TableHead>IP address</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last seen</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((s) => {
            const isCurrent = !!currentSessionId && s.id === currentSessionId;
            return (
              <TableRow key={s.id}>
                <TableCell
                  className="max-w-md truncate text-xs text-muted-foreground"
                  title={s.user_agent ?? ""}
                >
                  <MonitorMobile className="mr-1 inline size-3" />
                  {s.user_agent ?? "—"}
                  {isCurrent && (
                    <Badge variant="secondary" className="ml-2">
                      This device
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {formatIp(s.ip)}
                </TableCell>
                <TableCell>
                  <TimeSince value={s.created_at} />
                </TableCell>
                <TableCell>
                  <TimeSince value={s.last_seen_at} />
                </TableCell>
                <TableCell>
                  <StatusPill status={s.revoked_at ? "revoked" : "active"} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!!s.revoked_at || isCurrent || isRevoking}
                    onClick={() => onRevoke(s)}
                  >
                    Revoke
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </DataState>
  );
}
