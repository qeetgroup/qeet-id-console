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
  TimeSince,
} from "@qeetrix/ui";
import { Link, useNavigate } from "@tanstack/react-router";
import { StatusPill } from "@/platform/components/status-pill";
import { initials } from "@/shared/utils/initials";
import { formatDate } from "@/shared/utils/format";
import {
  CheckIcon,
  ChevronDownIcon,
  FileBracesIcon,
  LoaderCircleIcon,
  Maximize2Icon,
  MonitorXIcon,
  SendIcon,
  ShieldOffIcon,
  TrashIcon,
  UserCheckIcon,
  UserXIcon,
} from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import { useSendPasswordReset } from "../api/user360";
import { useUserActions } from "../use-user-actions";
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

/** Renders the User 360 header: identity, status, a meta strip and the Actions menu. */
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
  const actions = useUserActions();
  const sendReset = useSendPasswordReset();

  const name = user.display_name || user.email;
  const emailVerified = !!user.email_verified_at;
  const suspended = user.status === "suspended";

  const busy = actions.pending || sendReset.isPending;

  return (
    <div className="flex flex-col gap-4">
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
                  {busy ? (
                    <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  {t("detail.actions")}
                  <ChevronDownIcon className="size-4" aria-hidden="true" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" sideOffset={8} className="min-w-56">
              {canWrite ? (
                <>
                  <DropdownMenuItem onClick={() => actions.resetMfa(user)}>
                    <ShieldOffIcon />
                    {t("detail.resetMfaBtn")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => actions.revokeSessions(user)}>
                    <MonitorXIcon />
                    {t("detail.revokeAllBtn")}
                  </DropdownMenuItem>
                  {suspended ? (
                    <DropdownMenuItem onClick={() => actions.reactivate(user)}>
                      <UserCheckIcon />
                      {t("detail.reactivateBtn")}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => actions.suspend(user)}>
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
                <FileBracesIcon />
                {t("detail.viewRawBtn")}
              </DropdownMenuItem>
              {canWrite ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => actions.remove(user, () => navigate({ to: "/users" }))}
                  >
                    <TrashIcon />
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
