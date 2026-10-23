import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@qeetrix/ui";
import { EllipsisIcon, FileCheckIcon, RotateCcwIcon } from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { SuspendedDirectoryUser, SuspendedFilters, SuspendedUsersPage } from "@/modules/users";
import { initials } from "@/shared/utils/initials";
import {
  DIRECTORY_PANEL,
  DirectoryPagination,
  DirectorySkeletonRows,
  DirectoryStatus,
} from "./directory-ui";

/** The suspended people on this page, with selection for a bulk reactivation. */
export function SuspendedTable({
  page,
  filters,
  onFiltersChange,
  loading,
  error,
  busy,
  canWrite,
  isManageable,
  acting,
  onReactivate,
  onReview,
}: {
  page?: SuspendedUsersPage;
  filters: SuspendedFilters;
  onFiltersChange: (filters: SuspendedFilters) => void;
  loading: boolean;
  error: boolean;
  busy: boolean;
  canWrite: boolean;
  isManageable: (user: SuspendedDirectoryUser) => boolean;
  acting: boolean;
  onReactivate: (users: SuspendedDirectoryUser[]) => void;
  onReview: (user: SuspendedDirectoryUser) => void;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const items = page?.items ?? [];
  const eligible = items.filter(isManageable);
  const selectedUsers = eligible.filter((user) => selected.has(user.id));

  return (
    <section className={DIRECTORY_PANEL} aria-label={t("directory.suspended.title")}>
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <h2 className="font-heading text-sm font-semibold">
          {t("directory.suspended.title")}{" "}
          <span className="font-normal text-muted-foreground">({page?.total ?? 0})</span>
        </h2>
        {selectedUsers.length ? (
          <Button size="sm" disabled={acting} onClick={() => onReactivate(selectedUsers)}>
            <RotateCcwIcon />
            {t("directory.suspended.reactivateSelected", { count: selectedUsers.length })}
          </Button>
        ) : null}
      </header>
      <div className="overflow-x-auto">
        <Table className="w-full min-w-260 table-fixed text-xs [&_td]:px-2.5 [&_td]:py-1.5 [&_th]:px-2.5 [&_th]:text-[10px]">
          <colgroup>
            {canWrite ? <col className="w-8" /> : null}
            <col className="w-32" />
            <col className="w-38" />
            <col className="w-20" />
            <col className="w-31" />
            <col className="w-18" />
            <col className="w-26" />
            <col className="w-26" />
            <col className="w-26" />
            <col className="w-10" />
          </colgroup>
          <TableHeader className="border-y border-border/60 bg-muted/25">
            <TableRow>
              {canWrite ? (
                <TableHead>
                  <input
                    type="checkbox"
                    className="size-3.5 accent-primary"
                    aria-label={t("directory.suspended.selectAll")}
                    checked={eligible.length > 0 && eligible.every((user) => selected.has(user.id))}
                    disabled={acting || !eligible.length}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked ? new Set(eligible.map((user) => user.id)) : new Set(),
                      )
                    }
                  />
                </TableHead>
              ) : null}
              {[
                "name",
                "email",
                "team",
                "reason",
                "source",
                "since",
                "status",
                "lastSignIn",
                "actions",
              ].map((column) => (
                <TableHead key={column} aria-sort={column === "since" ? "descending" : undefined}>
                  {t(`directory.suspended.${column}`)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <DirectorySkeletonRows colSpan={10} />
            ) : (
              items.map((user) => (
                <TableRow key={user.id}>
                  {canWrite ? (
                    <TableCell>
                      <input
                        type="checkbox"
                        className="size-3.5 accent-primary"
                        aria-label={t("directory.suspended.select", {
                          name: user.display_name || user.email,
                        })}
                        disabled={acting || !isManageable(user)}
                        checked={selected.has(user.id)}
                        onChange={() =>
                          setSelected((current) => {
                            const next = new Set(current);
                            if (next.has(user.id)) next.delete(user.id);
                            else next.add(user.id);
                            return next;
                          })
                        }
                      />
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <SuspendedUserAvatar user={user} />
                      <span
                        className="min-w-0 truncate font-medium"
                        title={user.display_name || user.email}
                      >
                        {user.display_name || user.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-44 truncate text-muted-foreground" title={user.email}>
                    {user.email}
                  </TableCell>
                  <TableCell className="truncate text-muted-foreground" title={user.team}>
                    {user.team || "--"}
                  </TableCell>
                  <TableCell
                    className="truncate"
                    title={t(`directory.suspended.reasons.${user.reason}`)}
                  >
                    {t(`directory.suspended.reasons.${user.reason}`, {
                      defaultValue: user.reason,
                    })}
                  </TableCell>
                  <TableCell>
                    <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-700 dark:text-blue-400">
                      {t(`directory.suspended.sources.${user.source}`, {
                        defaultValue: user.source,
                      })}
                    </span>
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground"
                    title={
                      user.suspended_at
                        ? new Date(user.suspended_at).toLocaleString(i18n.resolvedLanguage)
                        : undefined
                    }
                  >
                    {user.suspended_at
                      ? new Date(user.suspended_at).toLocaleDateString(i18n.resolvedLanguage, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : t("directory.notReported")}
                  </TableCell>
                  <TableCell>
                    <DirectoryStatus
                      label={t(
                        user.risk === "unknown" && user.review === "pending"
                          ? "directory.suspended.pending"
                          : `directory.suspended.risks.${user.risk}`,
                      )}
                      tone={
                        user.risk === "high"
                          ? "danger"
                          : user.risk === "medium" || user.review === "pending"
                            ? "warning"
                            : user.risk === "low"
                              ? "success"
                              : "neutral"
                      }
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.last_sign_in
                      ? new Date(user.last_sign_in).toLocaleDateString(i18n.resolvedLanguage, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "--"}
                  </TableCell>
                  <TableCell>
                    {isManageable(user) ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              disabled={acting}
                              aria-label={t("directory.suspended.rowActions", {
                                name: user.display_name || user.email,
                              })}
                            />
                          }
                        >
                          <EllipsisIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onReview(user)}>
                            <FileCheckIcon />
                            {t("directory.suspended.review")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onReactivate([user])}>
                            <RotateCcwIcon />
                            {t("directory.suspended.reactivate")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span
                        className="text-[10px] text-muted-foreground"
                        title={t("directory.suspended.managedElsewhere")}
                      >
                        --
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
            {!loading && items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                  {t(error ? "directory.loadError" : "directory.suspended.empty")}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      <DirectoryPagination
        total={page?.total ?? 0}
        limit={filters.limit}
        offset={filters.offset}
        busy={busy}
        onChange={(offset) => onFiltersChange({ ...filters, offset })}
      />
    </section>
  );
}

export function SuspendedUserAvatar({ user }: { user: SuspendedDirectoryUser }) {
  const name = user.display_name || user.email;
  return (
    <Avatar className="size-6 shrink-0">
      <AvatarImage src={user.avatar_url ?? undefined} alt={name} />
      <AvatarFallback className="bg-muted text-[10px] text-muted-foreground">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
