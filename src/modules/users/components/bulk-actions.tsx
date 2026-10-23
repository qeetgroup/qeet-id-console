// There is no batch API, so each bulk action calls the per-user endpoint for every selected user,
// five at a time, and reports one combined toast. Every action is a sensitive one: the step-up
// dialog names it, and those that take access away confirm first.

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@qeetrix/ui";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDownIcon,
  DownloadIcon,
  LoaderCircleIcon,
  MonitorXIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserPlusIcon,
  UserXIcon,
  UsersRoundIcon,
} from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useRoles } from "@/modules/authorization";
import { useGroups } from "@/modules/groups";
import { useTenantId } from "@/platform/auth/session";
import {
  type SensitiveActionOptions,
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { type CsvColumn, exportToCsv, exportToJson } from "@/shared/utils/data-export";

import { userKeys } from "../api/keys";
import { perUserCalls, type User } from "../api/users";

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
  onDone,
}: {
  selectedUsers: User[];
  onDone: () => void;
}) {
  const { t } = useTranslation("users");
  const tenantId = useTenantId();
  const qc = useQueryClient();
  const runSensitive = useSensitiveAction();
  const [running, setRunning] = useState<{ label: string; done: number; total: number } | null>(
    null,
  );
  const rolesQ = useRoles();
  const groupsQ = useGroups();

  const ids = selectedUsers.map((u) => u.id);
  const busy = running !== null;

  async function fanOutAll(label: string, fn: (id: string) => Promise<unknown>) {
    setRunning({ label, done: 0, total: ids.length });
    const res = await fanOut(ids, fn, (done, total) => setRunning({ label, done, total }));
    setRunning(null);
    if (res.failed === 0) toast.success(t("bulk.actionOk", { n: res.ok }));
    else if (res.ok === 0) toast.error(t("bulk.actionFail", { n: res.failed }));
    else toast.warning(t("bulk.actionPartial", { ok: res.ok, failed: res.failed }));
    void qc.invalidateQueries({ queryKey: userKeys.tenant(tenantId) });
    onDone();
  }

  // The first refused call asks for the step-up, worded for this action, and the rest wait on it.
  function run(
    label: string,
    fn: (id: string) => Promise<unknown>,
    confirm?: SensitiveActionOptions<void>["confirm"],
  ) {
    void runSensitive({
      confirm,
      actionLabel: label.toLowerCase(),
      run: () => fanOutAll(label, fn),
    }).catch(settleSensitiveAction);
  }

  if (busy) {
    return (
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircleIcon className="size-4 animate-spin" />
        {running.label} · {running.done}/{running.total}
      </span>
    );
  }

  return (
    <>
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
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("bulk.pickRole")}</DropdownMenuLabel>
            {(rolesQ.data?.items ?? []).map((r) => (
              <DropdownMenuItem
                key={r.id}
                disabled={!tenantId}
                onClick={() =>
                  tenantId && run(t("bulk.assignRole"), perUserCalls.assignRole(tenantId, r.id))
                }
              >
                {r.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
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
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("bulk.pickGroup")}</DropdownMenuLabel>
            {(groupsQ.data?.items ?? []).length === 0 ? (
              <DropdownMenuItem disabled>{t("bulk.noGroups")}</DropdownMenuItem>
            ) : (
              (groupsQ.data?.items ?? []).map((g) => (
                <DropdownMenuItem
                  key={g.id}
                  onClick={() => run(t("bulk.addToGroup"), perUserCalls.addToGroup(g.id))}
                >
                  {g.name}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="outline"
        size="sm"
        onClick={() => run(t("bulk.requireMfa"), perUserCalls.requireMfa)}
      >
        <ShieldCheckIcon />
        {t("bulk.requireMfa")}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          run(t("detail.revokeAllBtn"), perUserCalls.revokeSessions, {
            title: t("bulk.revokeTitle", { n: ids.length }),
            description: t("bulk.revokeDescription"),
            confirmLabel: t("detail.revokeAllConfirm"),
            tone: "destructive",
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
          run(t("detail.suspendBtn"), perUserCalls.suspend, {
            title: t("bulk.suspendTitle", { n: ids.length }),
            description: t("bulk.suspendDescription"),
            confirmLabel: t("detail.suspendConfirm"),
            tone: "destructive",
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
              run(t("table.deleteUser"), perUserCalls.remove, {
                title: t("bulk.confirm", { count: ids.length }),
                description: t("bulk.deleteDescription"),
                confirmLabel: t("common:actions.delete"),
                tone: "destructive",
              })
            }
          >
            <TrashIcon />
            {t("table.deleteUser")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
