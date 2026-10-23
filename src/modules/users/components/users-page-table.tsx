import {
  Avatar,
  AvatarFallback,
  Badge,
  cn,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import { CircleCheckIcon, ShieldAlertIcon, ShieldCheckIcon } from "@qeetrix/icons";
import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";

import { MasterCheckbox, RowCheckbox, SortHeader } from "@/shared/components/data-table";
import type { SortState } from "@/shared/hooks/use-list-view";
import { initials } from "@/shared/utils/initials";

import type { User } from "../api/users";
import { primaryRole } from "../user-display";
import { type RowActionHandlers, UserRowActions } from "./user-row-actions";

type UsersTableProps = {
  rows: User[];
  currentUserId: string | null;
  canWrite: boolean; // Shows the selection column and the write row actions
  selectableIds: string[];
  selectedIds: Set<string>;
  onSelectedIdsChange: Dispatch<SetStateAction<Set<string>>>;
  sort: SortState;
  onToggleSort: (key: string) => void;
  onPreview: (user: User) => void;
  handlers: RowActionHandlers;
  className?: string;
};

/** Renders the users table: selection, the sortable columns and each row's actions. */
export function UsersTable({
  rows,
  currentUserId,
  canWrite,
  selectableIds,
  selectedIds,
  onSelectedIdsChange,
  sort,
  onToggleSort,
  onPreview,
  handlers,
  className,
}: UsersTableProps) {
  const { t } = useTranslation("users");
  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          {canWrite ? (
            <TableHead className="w-8">
              <MasterCheckbox
                selectableIds={selectableIds}
                selectedIds={selectedIds}
                onChange={onSelectedIdsChange}
                label={t("list.selectAll")}
              />
            </TableHead>
          ) : null}
          <SortHeader columnKey="name" sort={sort} onToggle={onToggleSort}>
            {t("table.user")}
          </SortHeader>
          <TableHead>{t("table.access")}</TableHead>
          <SortHeader columnKey="status" sort={sort} onToggle={onToggleSort}>
            {t("table.status")}
          </SortHeader>
          <TableHead>{t("table.security")}</TableHead>
          <SortHeader columnKey="lastSeen" sort={sort} onToggle={onToggleSort}>
            {t("table.lastSeen")}
          </SortHeader>
          <SortHeader columnKey="created" sort={sort} onToggle={onToggleSort}>
            {t("table.created")}
          </SortHeader>
          <TableHead className="w-10 text-right">
            <span className="sr-only">{t("table.actions")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((u) => {
          const isSelf = u.id === currentUserId;
          const isSelected = selectedIds.has(u.id);
          const name = u.display_name || u.email;
          const role = primaryRole(u.roles);
          return (
            <TableRow
              key={u.id}
              onClick={() => onPreview(u)}
              className={cn(
                "cursor-pointer transition-colors hover:bg-muted/40",
                isSelected && "bg-muted/40",
              )}
            >
              {canWrite ? (
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <RowCheckbox
                    id={u.id}
                    checked={isSelected}
                    disabled={isSelf}
                    label={t("list.selectOne", { email: u.email })}
                    onChange={(id, checked) =>
                      onSelectedIdsChange((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(id);
                        else next.delete(id);
                        return next;
                      })
                    }
                  />
                </TableCell>
              ) : null}

              {/* USER — identity first */}
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                      {initials(name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        to="/users/$userId"
                        params={{ userId: u.id }}
                        onClick={(e) => e.stopPropagation()}
                        className="truncate font-medium hover:underline"
                      >
                        {name}
                      </Link>
                      {isSelf && <Badge variant="muted">{t("list.you")}</Badge>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                  </div>
                </div>
              </TableCell>

              {/* ACCESS */}
              <TableCell>
                {role ? (
                  <div className="min-w-0">
                    <div className="font-medium capitalize">{role}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("access.rolesGroups", {
                        roles: u.roles?.length ?? 0,
                        groups: u.groups_count ?? 0,
                      })}
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">{t("access.noAccess")}</span>
                )}
              </TableCell>

              {/* STATUS */}
              <TableCell>
                <StatusPill status={u.status} dot />
              </TableCell>

              {/* SECURITY */}
              <TableCell>
                <SecurityCell user={u} />
              </TableCell>

              {/* LAST SEEN */}
              <TableCell className="text-sm text-muted-foreground">
                {u.last_seen_at ? (
                  <TimeSince value={u.last_seen_at} />
                ) : (
                  <span>{t("preview.never")}</span>
                )}
              </TableCell>

              {/* CREATED */}
              <TableCell className="text-sm text-muted-foreground">
                <TimeSince value={u.created_at} />
              </TableCell>

              {/* ACTIONS */}
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <UserRowActions user={u} canWrite={canWrite} isSelf={isSelf} handlers={handlers} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function SecurityCell({ user }: { user: User }) {
  const { t } = useTranslation("users");
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      <span className="inline-flex items-center gap-1">
        {user.email_verified_at ? (
          <CircleCheckIcon className="size-3.5 text-success" aria-hidden="true" />
        ) : (
          <ShieldAlertIcon className="size-3.5 text-warning" aria-hidden="true" />
        )}
        {/* Only the icon shows verification, so screen readers get it in words. */}
        <span aria-hidden="true">{t("security.email")}</span>
        <span className="sr-only">
          {user.email_verified_at ? t("security.emailVerified") : t("security.emailUnverified")}
        </span>
      </span>
      <span className="inline-flex items-center gap-1">
        {user.mfa_enabled ? (
          <ShieldCheckIcon className="size-3.5 text-success" aria-hidden="true" />
        ) : (
          <ShieldAlertIcon className="size-3.5 text-warning" aria-hidden="true" />
        )}
        {user.mfa_enabled ? t("security.mfaOn") : t("security.mfaOff")}
      </span>
    </div>
  );
}
