import { Button } from "@qeetrix/ui";
import { useNavigate } from "@tanstack/react-router";
import { type IconProps, MonitorXIcon, TrashIcon, UserCheckIcon, UserXIcon } from "@qeetrix/icons";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";

import { useUserActions } from "../use-user-actions";

/**
 * Renders the suspend or reactivate, revoke-sessions and delete actions; all but reactivate
 * confirm first. Render it only for user.write; the backend enforces that regardless.
 */
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
  const actions = useUserActions();
  const user = { id: userId, email };

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
          pending={actions.pendingAction.status}
          onClick={() => (suspended ? actions.reactivate(user) : actions.suspend(user))}
        />
        <DangerItem
          icon={MonitorXIcon}
          title={t("detail.revokeAllBtn")}
          description={t("detail.revokeAllDesc")}
          pending={actions.pendingAction.revokeSessions}
          onClick={() => actions.revokeSessions(user)}
        />
        <DangerItem
          icon={TrashIcon}
          title={t("detail.deleteBtn")}
          description={t("detail.deleteDesc")}
          destructive
          pending={actions.pendingAction.remove}
          onClick={() => actions.remove(user, () => navigate({ to: "/users" }))}
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
  icon: ComponentType<IconProps<"outline">>;
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
