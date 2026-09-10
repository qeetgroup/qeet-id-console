import {
  Activity,
  Copy,
  Edit,
  Forbidden,
  Key,
  More,
  ShieldCross,
  ShieldSlash,
  Trash,
  User as UserIcon,
  UserRemove,
  UserTick,
} from "@qeetrix/icons";
// The ⋯ row-actions menu. Navigation items are Links into User 360; mutating
// actions call up to page-level handlers (which own the hooks + confirm dialog).

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { User } from "./api/users";

export interface RowActionHandlers {
  onEdit: (u: User) => void;
  onSetPassword: (u: User) => void;
  onResetMfa: (u: User) => void;
  onRevokeSessions: (u: User) => void;
  onToggleSuspend: (u: User) => void;
  onDelete: (u: User) => void;
}

export function UserRowActions({
  user,
  canWrite,
  isSelf,
  handlers,
}: {
  user: User;
  canWrite: boolean;
  isSelf: boolean;
  handlers: RowActionHandlers;
}) {
  const { t } = useTranslation("users");
  const suspended = user.status === "suspended";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={t("table.actions")}>
            <More />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem render={<Link to="/users/$userId" params={{ userId: user.id }} />}>
          <UserIcon />
          {t("rowActions.view")}
        </DropdownMenuItem>
        <DropdownMenuItem
          render={
            <Link to="/users/$userId" params={{ userId: user.id }} search={{ tab: "access" }} />
          }
        >
          <Key />
          {t("rowActions.manageAccess")}
        </DropdownMenuItem>
        <DropdownMenuItem
          render={<Link to="/users/$userId/timeline" params={{ userId: user.id }} />}
        >
          <Activity />
          {t("rowActions.viewActivity")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            void navigator.clipboard.writeText(user.id);
            toast.success(t("rowActions.copied"));
          }}
        >
          <Copy />
          {t("rowActions.copyId")}
        </DropdownMenuItem>

        {canWrite ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handlers.onEdit(user)}>
              <Edit />
              {t("rowActions.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handlers.onSetPassword(user)}>
              <Key />
              {t("table.setPassword")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handlers.onResetMfa(user)}>
              <ShieldSlash />
              {t("detail.resetMfaBtn")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handlers.onRevokeSessions(user)}>
              <Forbidden />
              {t("detail.revokeAllBtn")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isSelf} onClick={() => handlers.onToggleSuspend(user)}>
              {suspended ? <UserTick /> : <UserRemove />}
              {suspended ? t("detail.reactivateBtn") : t("detail.suspendBtn")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={isSelf}
              onClick={() => handlers.onDelete(user)}
            >
              {isSelf ? <ShieldCross /> : <Trash />}
              {t("table.deleteUser")}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
