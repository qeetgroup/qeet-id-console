// Bulk-action bar contents. There is no batch API, so each action fans out over
// the selected users' per-user endpoints (bounded concurrency), reporting a
// combined success/failure toast. Assign-role / Add-to-group pick a target from
// a submenu; destructive actions confirm first.

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@qeetrix/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDownIcon,
  DownloadIcon,
  Loader2Icon,
  MonitorXIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UserPlusIcon,
  UsersRoundIcon,
  UserXIcon,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useConfirmDialog } from "@/components/confirm-dialog";
import { api } from "@/lib/api";
import { type CsvColumn, exportToCsv, exportToJson } from "@/lib/export";
import { useRoles } from "@/lib/rbac-groups";
import type { User } from "@/lib/users";

interface Group {
  id: string;
  name: string;
}

const exportColumns: CsvColumn<User>[] = [
  { header: "id", value: (u) => u.id },
  { header: "email", value: (u) => u.email },
  { header: "display_name", value: (u) => u.display_name },
  { header: "status", value: (u) => u.status },
  { header: "roles", value: (u) => (u.roles ?? []).join("|") },
  { header: "mfa_enabled", value: (u) => String(u.mfa_enabled ?? "") },
  { header: "last_seen_at", value: (u) => u.last_seen_at ?? "" },
  { header: "created_at", value: (u) => u.created_at },
];

async function fanOut(
  ids: string[],
  fn: (id: string) => Promise<unknown>,
  onProgress: (done: number, total: number) => void,
): Promise<{ ok: number; failed: number }> {
  const CONCURRENCY = 5;
  const queue = [...ids];
  let ok = 0;
  let failed = 0;
  let done = 0;
  async function worker() {
    for (;;) {
      const id = queue.shift();
      if (!id) return;
      try {
        await fn(id);
        ok++;
      } catch {
        failed++;
      }
      done++;
      onProgress(done, ids.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));
  return { ok, failed };
}

export function BulkActions({
  selectedUsers,
  tenantId,
  onDone,
}: {
  selectedUsers: User[];
  tenantId: string | null;
  onDone: () => void;
}) {
  const { t } = useTranslation("users");
  const qc = useQueryClient();
  const [confirmDialog, openConfirm] = useConfirmDialog();
  const [running, setRunning] = useState<{ label: string; done: number; total: number } | null>(
    null,
  );
  const rolesQ = useRoles();
  const groupsQ = useQuery({
    queryKey: ["groups", tenantId],
    queryFn: () => api<{ items: Group[] }>(`/v1/tenants/${tenantId}/groups`),
    enabled: !!tenantId,
  });

  const ids = selectedUsers.map((u) => u.id);
  const busy = running !== null;

  async function run(label: string, fn: (id: string) => Promise<unknown>) {
    setRunning({ label, done: 0, total: ids.length });
    const res = await fanOut(ids, fn, (done, total) => setRunning({ label, done, total }));
    setRunning(null);
    if (res.failed === 0) toast.success(t("bulk.actionOk", { n: res.ok }));
    else if (res.ok === 0) toast.error(t("bulk.actionFail", { n: res.failed }));
    else toast.warning(t("bulk.actionPartial", { ok: res.ok, failed: res.failed }));
    qc.invalidateQueries({ queryKey: ["users"] });
    qc.invalidateQueries({ queryKey: ["user-stats"] });
    onDone();
  }

  if (busy) {
    return (
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        {running.label} · {running.done}/{running.total}
      </span>
    );
  }

  return (
    <>
      {confirmDialog}

      {/* Assign role */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm">
              <UserPlusIcon />
              {t("bulk.assignRole")}
              <ChevronDownIcon className="size-3.5" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
          <DropdownMenuLabel>{t("bulk.pickRole")}</DropdownMenuLabel>
          {(rolesQ.data?.items ?? []).map((r) => (
            <DropdownMenuItem
              key={r.id}
              onClick={() =>
                run(t("bulk.assignRole"), (uid) =>
                  api<void>(`/v1/users/${uid}/tenants/${tenantId}/roles/${r.id}`, {
                    method: "POST",
                  }),
                )
              }
            >
              {r.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Add to group */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm">
              <UsersRoundIcon />
              {t("bulk.addToGroup")}
              <ChevronDownIcon className="size-3.5" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
          <DropdownMenuLabel>{t("bulk.pickGroup")}</DropdownMenuLabel>
          {(groupsQ.data?.items ?? []).length === 0 ? (
            <DropdownMenuItem disabled>{t("bulk.noGroups")}</DropdownMenuItem>
          ) : (
            (groupsQ.data?.items ?? []).map((g) => (
              <DropdownMenuItem
                key={g.id}
                onClick={() =>
                  run(t("bulk.addToGroup"), (uid) =>
                    api<void>(`/v1/groups/${g.id}/members/${uid}`, { method: "POST" }),
                  )
                }
              >
                {g.name}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          run(t("bulk.requireMfa"), (uid) =>
            api<void>(`/v1/users/${uid}/mfa-required`, {
              method: "PUT",
              body: { required: true },
            }),
          )
        }
      >
        <ShieldCheckIcon />
        {t("bulk.requireMfa")}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          openConfirm({
            title: t("bulk.revokeTitle", { n: ids.length }),
            description: t("bulk.revokeDescription"),
            variant: "destructive",
            confirmLabel: t("detail.revokeAllConfirm"),
            onConfirm: () =>
              run(t("detail.revokeAllBtn"), (uid) =>
                api<void>(`/v1/users/${uid}/sessions/revoke-all`, { method: "POST" }),
              ),
          })
        }
      >
        <MonitorXIcon />
        {t("detail.revokeAllBtn")}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          openConfirm({
            title: t("bulk.suspendTitle", { n: ids.length }),
            description: t("bulk.suspendDescription"),
            variant: "destructive",
            confirmLabel: t("detail.suspendConfirm"),
            onConfirm: () =>
              run(t("detail.suspendBtn"), (uid) =>
                api<void>(`/v1/users/${uid}`, { method: "PATCH", body: { status: "suspended" } }),
              ),
          })
        }
      >
        <UserXIcon />
        {t("detail.suspendBtn")}
      </Button>

      {/* More */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm">
              {t("bulk.more")}
              <ChevronDownIcon className="size-3.5" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => exportToCsv("users", selectedUsers, exportColumns)}>
            <DownloadIcon />
            {t("bulk.exportCsv")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportToJson("users", selectedUsers)}>
            <DownloadIcon />
            {t("bulk.exportJson")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() =>
              openConfirm({
                title: t("bulk.confirm", { count: ids.length }),
                description: t("bulk.deleteDescription"),
                variant: "destructive",
                confirmLabel: t("common:actions.delete"),
                onConfirm: () =>
                  run(t("table.deleteUser"), (uid) =>
                    api<void>(`/v1/users/${uid}`, { method: "DELETE" }),
                  ),
              })
            }
          >
            <Trash2Icon />
            {t("table.deleteUser")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
