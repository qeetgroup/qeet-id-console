import {
  Button,
  FieldError,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@qeetrix/ui";
import { TrashIcon, UserPlusIcon } from "@qeetrix/icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { userQueries } from "@/modules/users";
import { useTenantId } from "@/platform/auth/session";
import { DataState } from "@/platform/components/data-state";
import { ErrorText } from "@/platform/components/error-reference";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

import {
  type GroupMember,
  useAddGroupMember,
  useGroupMembers,
  useRemoveGroupMember,
} from "../api/groups";

type GroupMembersSheetProps = {
  groupId: string;
  groupName: string;
  onClose: () => void;
};

// The picker searches the tenant's first page of users.
const PICKER_PAGE = { limit: 200, offset: 0 };

/** Renders a group's members with a picker to add users and a confirmed remove. */
export function GroupMembersSheet({ groupId, groupName, onClose }: GroupMembersSheetProps) {
  const { t } = useTranslation("groups");
  const tenantId = useTenantId();
  const runSensitive = useSensitiveAction();
  const [query, setQuery] = useState("");

  const membersQ = useGroupMembers(groupId);
  const usersQ = useQuery(userQueries.list(tenantId, PICKER_PAGE));
  const addM = useAddGroupMember();
  const removeM = useRemoveGroupMember();

  const add = (userId: string) =>
    addM.mutate({ groupId, userId }, { onSuccess: () => setQuery("") });
  // Removing a member ends the access they inherited through the group.
  const remove = (m: GroupMember) =>
    runSensitive({
      confirm: {
        title: t("members.removeTitle", { name: m.display_name || m.email || m.user_id }),
        description: t("members.removeDescription"),
        confirmLabel: t("members.removeConfirm"),
        tone: "destructive",
      },
      actionLabel: t("members.removeAction"),
      run: () => removeM.mutateAsync({ groupId, userId: m.user_id }),
    }).catch(settleSensitiveAction);

  const memberIds = new Set((membersQ.data?.items ?? []).map((m) => m.user_id));
  const q = query.trim().toLowerCase();
  const candidates = (usersQ.data?.items ?? [])
    .filter((u) => !memberIds.has(u.id))
    .filter(
      (u) =>
        q !== "" &&
        ((u.display_name ?? "").toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
    )
    .slice(0, 8);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("members.title", { groupName })}</SheetTitle>
          <SheetDescription>{t("members.description")}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="relative">
            <Input
              placeholder={t("members.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {q !== "" && (
              <div className="mt-1 overflow-hidden rounded-md border">
                {usersQ.isLoading ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    {t("members.loadingUsers")}
                  </p>
                ) : candidates.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">{t("members.noMatch")}</p>
                ) : (
                  candidates.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      disabled={addM.isPending}
                      onClick={() => add(u.id)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60 disabled:opacity-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {u.display_name || u.email}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {u.email}
                        </span>
                      </span>
                      <UserPlusIcon className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {addM.error && (
            <FieldError>
              <ErrorText error={addM.error} />
            </FieldError>
          )}

          <DataState
            isLoading={membersQ.isLoading}
            isError={membersQ.isError}
            error={membersQ.error}
            isEmpty={!membersQ.data?.items.length}
            emptyTitle={t("members.noMembers")}
            skeletonRows={3}
          >
            {membersQ.data?.items.map((m) => (
              <div
                key={m.user_id}
                className="flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {m.display_name ?? m.email ?? m.user_id}
                  </div>
                  <code className="text-xs text-muted-foreground">{m.user_id.slice(0, 16)}…</code>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t("members.removeLabel")}
                  onClick={() => remove(m)}
                  disabled={removeM.isPending}
                >
                  <TrashIcon />
                </Button>
              </div>
            ))}
          </DataState>
        </div>
        <SheetFooter className="flex-row justify-end gap-2 border-t">
          <Button variant="outline" onClick={onClose}>
            {t("members.close")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
