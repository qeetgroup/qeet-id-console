// User 360 hero header: identity, status, quick meta strip, and the contextual
// "Actions" menu (with confirmation on anything destructive).

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  StatusPill,
  TimeSince,
} from "@qeetrix/ui";
import { Link, useNavigate } from "@tanstack/react-router";
import { initials } from "@/shared/utils/initials";
import { formatDate } from "@/shared/utils/format";
import {
  CheckIcon,
  ChevronDownIcon,
  FileJsonIcon,
  Loader2Icon,
  Maximize2Icon,
  MonitorXIcon,
  SendIcon,
  ShieldOffIcon,
  Trash2Icon,
  UserCheckIcon,
  UserXIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useConfirmDialog } from "@/shared/components/confirm-dialog";
import { useDeleteUser, useResetUserMfa, useSetUserStatus } from "./api/users";
import { useRevokeAllUserSessions, useSendPasswordReset } from "./api/user360";
import { CopyId } from "./user-detail-fields";

export interface HeaderUser {
  id: string;
  tenant_id: string;
  email: string;
  display_name?: string | null;
  avatar_url?: string | null;
  status: "active" | "invited" | "suspended" | "deleted";
  email_verified_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export function UserDetailHeader({
  user,
  lastSeenAt,
  canWrite,
  onViewRaw,
}: {
  user: HeaderUser;
  lastSeenAt?: string | null;
  canWrite: boolean;
  onViewRaw: () => void;
}) {
  const { t } = useTranslation("users");
  const navigate = useNavigate();
  const [confirmDialog, openConfirm] = useConfirmDialog();

  const resetMfa = useResetUserMfa();
  const setStatus = useSetUserStatus();
  const del = useDeleteUser();
  const revokeAll = useRevokeAllUserSessions();
  const sendReset = useSendPasswordReset();

  const name = user.display_name || user.email;
  const emailVerified = !!user.email_verified_at;
  const suspended = user.status === "suspended";

  const busy =
    resetMfa.isPending ||
    setStatus.isPending ||
    del.isPending ||
    revokeAll.isPending ||
    sendReset.isPending;

  return (
    <div className="flex flex-col gap-4">
      {confirmDialog}

      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* Identity */}
        <div className="flex min-w-0 items-start gap-4">
          <Avatar className="size-14 rounded-xl">
            {user.avatar_url ? <AvatarImage src={user.avatar_url} alt={name} /> : null}
            <AvatarFallback className="rounded-xl bg-primary text-lg font-semibold text-primary-foreground">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight">{name}</h1>
              <StatusPill status={user.status} dot />
              {emailVerified ? (
                <Badge variant="success" className="gap-1">
                  <CheckIcon className="size-3" aria-hidden="true" />
                  {t("detail.verified")}
                </Badge>
              ) : (
                <Badge variant="warning">{t("detail.unverified")}</Badge>
              )}
            </div>
            <div className="mt-0.5 truncate text-sm text-muted-foreground">{user.email}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t("detail.userSince", { date: formatDate(user.created_at) })} ·{" "}
              <TimeSince value={user.created_at} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" disabled={busy}>
                  {busy ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
                  {t("detail.actions")}
                  <ChevronDownIcon className="size-4" aria-hidden="true" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" sideOffset={8} className="min-w-56">
              {canWrite ? (
                <>
                  <DropdownMenuItem
                    onClick={() =>
                      openConfirm({
                        title: t("detail.resetMfaConfirmTitle"),
                        description: t("detail.resetMfaConfirmDescription"),
                        variant: "destructive",
                        confirmLabel: t("detail.resetMfaConfirmLabel"),
                        onConfirm: () => resetMfa.mutate(user.id),
                      })
                    }
                  >
                    <ShieldOffIcon />
                    {t("detail.resetMfaBtn")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      openConfirm({
                        title: t("detail.revokeAllTitle"),
                        description: t("detail.revokeAllDescription"),
                        variant: "destructive",
                        confirmLabel: t("detail.revokeAllConfirm"),
                        onConfirm: () => revokeAll.mutate(user.id),
                      })
                    }
                  >
                    <MonitorXIcon />
                    {t("detail.revokeAllBtn")}
                  </DropdownMenuItem>
                  {suspended ? (
                    <DropdownMenuItem
                      onClick={() => setStatus.mutate({ userId: user.id, status: "active" })}
                    >
                      <UserCheckIcon />
                      {t("detail.reactivateBtn")}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() =>
                        openConfirm({
                          title: t("detail.suspendTitle"),
                          description: t("detail.suspendDescription"),
                          variant: "destructive",
                          confirmLabel: t("detail.suspendConfirm"),
                          onConfirm: () =>
                            setStatus.mutate({ userId: user.id, status: "suspended" }),
                        })
                      }
                    >
                      <UserXIcon />
                      {t("detail.suspendBtn")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => sendReset.mutate(user.email)}>
                    <SendIcon />
                    {t("detail.sendResetBtn")}
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuItem onClick={onViewRaw}>
                <FileJsonIcon />
                {t("detail.viewRawBtn")}
              </DropdownMenuItem>
              {canWrite ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() =>
                      openConfirm({
                        title: t("detail.deleteTitle"),
                        description: t("detail.deleteDescription", { email: user.email }),
                        variant: "destructive",
                        confirmLabel: t("detail.deleteConfirm"),
                        onConfirm: () =>
                          del.mutate(user.id, {
                            onSuccess: () => navigate({ to: "/users" }),
                          }),
                      })
                    }
                  >
                    <Trash2Icon />
                    {t("detail.deleteBtn")}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="icon"
            nativeButton={false}
            render={<Link to="/users/$userId/timeline" params={{ userId: user.id }} />}
            aria-label={t("detail.openTimeline")}
          >
            <Maximize2Icon className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Meta strip */}
      <div className="grid grid-cols-2 divide-x divide-y divide-border rounded-xl border sm:grid-cols-4 sm:divide-y-0">
        <MetaCell label={t("detail.fieldUserId")}>
          <CopyId value={user.id} label={t("detail.copyUserId")} />
        </MetaCell>
        <MetaCell label={t("detail.fieldTenant")}>
          <CopyId value={user.tenant_id} label={t("detail.copyTenant")} />
        </MetaCell>
        <MetaCell label={t("detail.fieldCreated")}>
          <TimeSince value={user.created_at} className="text-sm" />
        </MetaCell>
        <MetaCell label={t("detail.lastSeen")}>
          {lastSeenAt ? (
            <TimeSince value={lastSeenAt} className="text-sm" />
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </MetaCell>
      </div>
    </div>
  );
}

function MetaCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 min-w-0">{children}</div>
    </div>
  );
}
