// Danger zone — destructive lifecycle actions, each with an explained
// confirmation. Only rendered for user.write; otherwise the caller shows a
// read-only notice instead.

import { Button } from "@qeetrix/ui";
import { useNavigate } from "@tanstack/react-router";
import { MonitorXIcon, Trash2Icon, UserCheckIcon, UserXIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  SensitiveActionCancelled,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { useDeleteUser, useSetUserStatus } from "./api/users";
import { useRevokeAllUserSessions } from "./api/user360";

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
  const runSensitive = useSensitiveAction();
  const setStatus = useSetUserStatus();
  const del = useDeleteUser();
  const revokeAll = useRevokeAllUserSessions();

  // Sensitive actions flow through the shared confirm → step-up → api pipeline.
  // A backend `step_up_required` re-auth is handled by the provider (dialog +
  // retry) instead of dead-ending. Cancellation is expected and swallowed.
  const ignoreCancel = (err: unknown) => {
    if (!(err instanceof SensitiveActionCancelled)) throw err;
  };

  return (
    <section className="rounded-xl border border-destructive/30">
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
            runSensitive({
              confirm: {
                title: t("detail.suspendTitle"),
                description: t("detail.suspendDescription"),
                confirmLabel: t("detail.suspendConfirm"),
                tone: "destructive",
              },
              actionLabel: t("detail.suspendBtn").toLowerCase(),
              run: () => setStatus.mutateAsync({ userId, status: "suspended" }),
            }).catch(ignoreCancel);
          }}
        />
        <DangerItem
          icon={MonitorXIcon}
          title={t("detail.revokeAllBtn")}
          description={t("detail.revokeAllDesc")}
          pending={revokeAll.isPending}
          onClick={() =>
            runSensitive({
              confirm: {
                title: t("detail.revokeAllTitle"),
                description: t("detail.revokeAllDescription"),
                confirmLabel: t("detail.revokeAllConfirm"),
                tone: "destructive",
              },
              actionLabel: t("detail.revokeAllBtn").toLowerCase(),
              run: () => revokeAll.mutateAsync(userId),
            }).catch(ignoreCancel)
          }
        />
        <DangerItem
          icon={Trash2Icon}
          title={t("detail.deleteBtn")}
          description={t("detail.deleteDesc")}
          destructive
          pending={del.isPending}
          onClick={() =>
            runSensitive({
              confirm: {
                title: t("detail.deleteTitle"),
                description: t("detail.deleteDescription", { email }),
                confirmLabel: t("detail.deleteConfirm"),
                tone: "destructive",
              },
              actionLabel: t("detail.deleteBtn").toLowerCase(),
              run: () => del.mutateAsync(userId),
            })
              .then(() => navigate({ to: "/users" }))
              .catch(ignoreCancel)
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
