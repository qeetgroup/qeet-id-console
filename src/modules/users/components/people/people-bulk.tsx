// There is no batch API, so each bulk action calls the per-user endpoint for every chosen person,
// five at a time, and reports one combined toast. Every action is a sensitive one: the step-up
// dialog names it, and those that take access away confirm first.

import {
  DownloadIcon,
  EllipsisIcon,
  KeyRoundIcon,
  LogOutIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserXIcon,
  UsersRoundIcon,
} from "@qeetrix/icons";
import {
  Button,
  Menu,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Spinner,
  Text,
} from "@qeetrix/react";
import { useQueryClient } from "@tanstack/react-query";
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

import { userKeys } from "@/modules/users/api/keys";
import { perUserCalls, type User } from "@/modules/users/api/users";

export const peopleCsvColumns: CsvColumn<User>[] = [
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

type Running = { label: string; done: number; total: number };

/**
 * Runs one per-user call for several people: the step-up (and a confirmation, if given) first,
 * then the calls, then one toast and a refresh of the users views.
 */
export function usePeopleRun(
  onDone?: () => void,
  /** The toast when every call worked; default "Updated N users". */
  okMessage?: (n: number) => string,
) {
  const { t } = useTranslation("users");
  const tenantId = useTenantId();
  const qc = useQueryClient();
  const runSensitive = useSensitiveAction();
  const [running, setRunning] = useState<Running | null>(null);

  async function fanOutAll(label: string, ids: string[], fn: (id: string) => Promise<unknown>) {
    setRunning({ label, done: 0, total: ids.length });
    const res = await fanOut(ids, fn, (done, total) => setRunning({ label, done, total }));
    setRunning(null);
    if (res.failed === 0) toast.success(okMessage?.(res.ok) ?? t("bulk.actionOk", { n: res.ok }));
    else if (res.ok === 0) toast.error(t("bulk.actionFail", { n: res.failed }));
    else toast.warning(t("bulk.actionPartial", { ok: res.ok, failed: res.failed }));
    void qc.invalidateQueries({ queryKey: userKeys.tenant(tenantId) });
    onDone?.();
  }

  // The first refused call asks for the step-up, worded for this action, and the rest wait on it.
  function run(
    label: string,
    ids: string[],
    fn: (id: string) => Promise<unknown>,
    confirm?: SensitiveActionOptions<void>["confirm"],
  ) {
    if (ids.length === 0) return;
    void runSensitive({
      confirm,
      actionLabel: label,
      run: () => fanOutAll(label, ids, fn),
    }).catch(settleSensitiveAction);
  }

  return { run, running };
}

/** The roles, as menu items that give the chosen one to `ids`. */
export function RoleItems({
  run,
  ids,
}: {
  run: ReturnType<typeof usePeopleRun>["run"];
  ids: string[];
}) {
  const { t } = useTranslation("users");
  const tenantId = useTenantId();
  const roles = useRoles().data?.items ?? [];
  return (
    <MenuGroup>
      <MenuGroupLabel>{t("bulk.pickRole")}</MenuGroupLabel>
      {roles.map((role) => (
        <MenuItem
          key={role.id}
          disabled={!tenantId}
          onClick={() =>
            tenantId &&
            run(t("people.actions.assignRole"), ids, perUserCalls.assignRole(tenantId, role.id))
          }
        >
          {role.name}
        </MenuItem>
      ))}
    </MenuGroup>
  );
}

/** The groups, as menu items that add `ids` to the chosen one. */
export function GroupItems({
  run,
  ids,
}: {
  run: ReturnType<typeof usePeopleRun>["run"];
  ids: string[];
}) {
  const { t } = useTranslation("users");
  const groups = useGroups().data?.items ?? [];
  return (
    <MenuGroup>
      <MenuGroupLabel>{t("bulk.pickGroup")}</MenuGroupLabel>
      {groups.length === 0 ? (
        <MenuItem disabled>{t("bulk.noGroups")}</MenuItem>
      ) : (
        groups.map((group) => (
          <MenuItem
            key={group.id}
            onClick={() =>
              run(t("people.actions.addToGroup"), ids, perUserCalls.addToGroup(group.id))
            }
          >
            {group.name}
          </MenuItem>
        ))
      )}
    </MenuGroup>
  );
}

/**
 * The selection's actions, in the table's bar: require two-step, a role, a group, and the rest
 * under More. Signing out, suspending and deleting leave out the person using the console, since
 * the Table can't keep their row out of the selection yet (QTRX-16).
 */
export function PeopleBulkActions({
  selected,
  currentUserId,
  onDone,
}: {
  selected: User[];
  currentUserId: string | null;
  onDone: () => void;
}) {
  const { t } = useTranslation(["users", "common"]);
  const { run, running } = usePeopleRun(onDone);
  const ids = selected.map((u) => u.id);
  const others = ids.filter((id) => id !== currentUserId);

  if (running) {
    return (
      <span className="ppl-running" role="status">
        <Spinner size="sm" decorative />
        <Text tone="subtle">
          {t("people.bulk.progress", {
            label: running.label,
            done: running.done,
            total: running.total,
          })}
        </Text>
      </span>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        icon={ShieldCheckIcon}
        onClick={() => run(t("people.actions.requireTwoStep"), ids, perUserCalls.requireMfa)}
      >
        {t("people.bulk.requireTwoStep", { n: ids.length })}
      </Button>
      <Menu>
        <MenuTrigger
          render={
            <Button variant="ghost" size="sm" icon={KeyRoundIcon}>
              {t("people.actions.assignRole")}
            </Button>
          }
        />
        <MenuContent>
          <RoleItems run={run} ids={ids} />
        </MenuContent>
      </Menu>
      <Menu>
        <MenuTrigger
          render={
            <Button variant="ghost" size="sm" icon={UsersRoundIcon}>
              {t("people.actions.addToGroup")}
            </Button>
          }
        />
        <MenuContent>
          <GroupItems run={run} ids={ids} />
        </MenuContent>
      </Menu>
      <Menu>
        <MenuTrigger
          render={
            <Button variant="ghost" size="sm" icon={EllipsisIcon}>
              {t("bulk.more")}
            </Button>
          }
        />
        <MenuContent align="end">
          <MenuItem
            icon={LogOutIcon}
            disabled={others.length === 0}
            onClick={() =>
              run(t("people.actions.signOutEverywhere"), others, perUserCalls.revokeSessions, {
                title: t("bulk.revokeTitle", { n: others.length }),
                description: t("bulk.revokeDescription"),
                confirmLabel: t("detail.revokeAllConfirm"),
                tone: "destructive",
              })
            }
          >
            {t("people.actions.signOutEverywhere")}
          </MenuItem>
          <MenuItem
            icon={UserXIcon}
            disabled={others.length === 0}
            onClick={() =>
              run(t("detail.suspendBtn"), others, perUserCalls.suspend, {
                title: t("bulk.suspendTitle", { n: others.length }),
                description: t("bulk.suspendDescription"),
                confirmLabel: t("detail.suspendConfirm"),
                tone: "destructive",
              })
            }
          >
            {t("detail.suspendBtn")}
          </MenuItem>
          <MenuItem
            icon={DownloadIcon}
            onClick={() => exportToCsv("users", selected, peopleCsvColumns)}
          >
            {t("bulk.exportCsv")}
          </MenuItem>
          <MenuItem icon={DownloadIcon} onClick={() => exportToJson("users", selected)}>
            {t("bulk.exportJson")}
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            icon={TrashIcon}
            tone="danger"
            disabled={others.length === 0}
            onClick={() =>
              run(t("table.deleteUser"), others, perUserCalls.remove, {
                title: t("bulk.confirm", { count: others.length }),
                description: t("bulk.deleteDescription"),
                confirmLabel: t("common:actions.delete"),
                tone: "destructive",
              })
            }
          >
            {t("table.deleteUser")}
          </MenuItem>
        </MenuContent>
      </Menu>
    </>
  );
}
