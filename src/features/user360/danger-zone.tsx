// Danger zone — destructive lifecycle actions, each with an explained
// confirmation. Only rendered for user.write; otherwise the caller shows a
// read-only notice instead.

import { Button } from "@qeetrix/ui";
import { useNavigate } from "@tanstack/react-router";
import { MonitorXIcon, Trash2Icon, UserCheckIcon, UserXIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useConfirmDialog } from "@/components/confirm-dialog";
import { useDeleteUser, useSetUserStatus } from "@/lib/users";
import { useRevokeAllUserSessions } from "@/lib/user360";

export function DangerZone({
  userId,
  email,
  suspended,
}: {
  userId: string;
  email: string;
  suspended: boolean;
}) {
  const { t } = useTranslation("users");
  const navigate = useNavigate();
  const [confirmDialog, openConfirm] = useConfirmDialog();
  const setStatus = useSetUserStatus();
  const del = useDeleteUser();
  const revokeAll = useRevokeAllUserSessions();

  return (
    <section className="rounded-xl border border-destructive/30">
      {confirmDialog}
      <header className="border-b border-destructive/20 px-4 py-3">
        <h3 className="text-sm font-semibold text-destructive">{t("detail.dangerZone")}</h3>
        <p className="text-xs text-muted-foreground">{t("detail.dangerZoneHint")}</p>
      </header>
      <div className="grid gap-px sm:grid-cols-3">
        <DangerItem
          icon={suspended ? UserCheckIcon : UserXIcon}
          title={suspended ? t("detail.reactivateBtn") : t("detail.suspendBtn")}
          description={suspended ? t("detail.reactivateDesc") : t("detail.suspendDesc")}
          pending={setStatus.isPending}
          onClick={() => {
            if (suspended) {
              setStatus.mutate({ userId, status: "active" });
              return;
            }
            openConfirm({
              title: t("detail.suspendTitle"),
              description: t("detail.suspendDescription"),
              variant: "destructive",
              confirmLabel: t("detail.suspendConfirm"),
              onConfirm: () => setStatus.mutate({ userId, status: "suspended" }),
            });
          }}
        />
        <DangerItem
          icon={MonitorXIcon}
          title={t("detail.revokeAllBtn")}
          description={t("detail.revokeAllDesc")}
          pending={revokeAll.isPending}
          onClick={() =>
            openConfirm({
              title: t("detail.revokeAllTitle"),
              description: t("detail.revokeAllDescription"),
              variant: "destructive",
              confirmLabel: t("detail.revokeAllConfirm"),
              onConfirm: () => revokeAll.mutate(userId),
            })
          }
        />
        <DangerItem
          icon={Trash2Icon}
          title={t("detail.deleteBtn")}
          description={t("detail.deleteDesc")}
          destructive
          pending={del.isPending}
          onClick={() =>
            openConfirm({
              title: t("detail.deleteTitle"),
              description: t("detail.deleteDescription", { email }),
              variant: "destructive",
              confirmLabel: t("detail.deleteConfirm"),
              onConfirm: () => del.mutate(userId, { onSuccess: () => navigate({ to: "/users" }) }),
            })
          }
        />
      </div>
    </section>
  );
}

function DangerItem({
  icon: Icon,
  title,
  description,
  onClick,
  pending,
  destructive,
}: {
  icon: typeof UserXIcon;
  title: string;
  description: string;
  onClick: () => void;
  pending?: boolean;
  destructive?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2">
        <Icon
          className={destructive ? "size-4 text-destructive" : "size-4 text-muted-foreground"}
          aria-hidden="true"
        />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <Button
        variant={destructive ? "destructive" : "outline"}
        size="sm"
        className="mt-1 w-fit"
        onClick={onClick}
        disabled={pending}
      >
        {title}
      </Button>
    </div>
  );
}
