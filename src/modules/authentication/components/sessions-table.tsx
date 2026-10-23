import { useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { DataState } from "@/platform/components/data-state";
import { StatusPill } from "@/platform/components/status-pill";
import { MonitorSmartphoneIcon, ShieldIcon } from "@qeetrix/icons";
import type { UseQueryResult } from "@tanstack/react-query";

import { formatIp } from "@/shared/utils/ip-format";
import { type Session, sessionCountry, sessionDevice, sessionStatus } from "../api/sessions";

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
 * Renders the active-sessions table that every session view shares. Presentational only:
 * confirmation and step-up are the caller's, through `onRevoke` (see useSensitiveAction).
 */
export function SessionsTable({
  query,
  currentSessionId,
  onRevoke,
  isRevoking,
  emptyLabel,
}: SessionsTableProps) {
  const { t } = useTranslation(["authentication", "common"]);
  const items = query.data?.items ?? [];
  return (
    <DataState
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      isEmpty={items.length === 0}
      emptyIcon={ShieldIcon}
      emptyTitle={emptyLabel ?? t("sessionsTable.empty")}
      skeletonRows={3}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("sessionsTable.device")}</TableHead>
            <TableHead>{t("sessionsTable.ipAddress")}</TableHead>
            <TableHead>{t("common:labels.created")}</TableHead>
            <TableHead>{t("sessionsTable.lastSeen")}</TableHead>
            <TableHead>{t("common:labels.status")}</TableHead>
            <TableHead className="text-right">{t("common:labels.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((s) => {
            // The server marks the session the list was requested with.
            const isCurrent = s.current ?? (!!currentSessionId && s.id === currentSessionId);
            const country = sessionCountry(s);
            return (
              <TableRow key={s.id}>
                <TableCell
                  className="max-w-md truncate text-xs text-muted-foreground"
                  title={s.user_agent ?? ""}
                >
                  <MonitorSmartphoneIcon className="mr-1 inline size-3" />
                  {sessionDevice(s)}
                  {country && <span className="ml-1">· {country}</span>}
                  {isCurrent && (
                    <Badge variant="secondary" className="ml-2">
                      {t("sessionsTable.thisDevice")}
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
                  <StatusPill status={sessionStatus(s)} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={sessionStatus(s) !== "active" || isCurrent || isRevoking}
                    onClick={() => onRevoke(s)}
                  >
                    {t("common:actions.revoke")}
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
