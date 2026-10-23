import { useTranslation } from "react-i18next";

import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

import { useRevokeAllUserSessions, useSetMfaRequired } from "./api/user360";
import { useDeleteUser, useResetUserMfa, useSetUserStatus } from "./api/users";

type Target = { id: string; email?: string };

/**
 * Returns the actions that take away a user's access, each confirmed and stepped up the same way
 * wherever it is offered: the list, the User 360 header and its danger zone, the timeline.
 */
export function useUserActions() {
  const { t } = useTranslation("users");
  const runSensitive = useSensitiveAction();
  const resetMfa = useResetUserMfa();
  const revokeAll = useRevokeAllUserSessions();
  const setStatus = useSetUserStatus();
  const del = useDeleteUser();
  const mfaRequired = useSetMfaRequired();

  return {
    pending: resetMfa.isPending || revokeAll.isPending || setStatus.isPending || del.isPending,
    pendingAction: {
      resetMfa: resetMfa.isPending,
      revokeSessions: revokeAll.isPending,
      status: setStatus.isPending, // suspend or reactivate
      remove: del.isPending,
      mfaRequired: mfaRequired.isPending,
    },
    resetMfa: (user: Target) =>
      runSensitive({
        confirm: {
          title: t("detail.resetMfaConfirmTitle"),
          description: t("detail.resetMfaConfirmDescription"),
          confirmLabel: t("detail.resetMfaConfirmLabel"),
          tone: "destructive",
        },
        actionLabel: t("detail.resetMfaBtn"),
        run: () => resetMfa.mutateAsync(user.id),
      }).catch(settleSensitiveAction),
    revokeSessions: (user: Target) =>
      runSensitive({
        confirm: {
          title: t("detail.revokeAllTitle"),
          description: t("detail.revokeAllDescription"),
          confirmLabel: t("detail.revokeAllConfirm"),
          tone: "destructive",
        },
        actionLabel: t("detail.revokeAllBtn"),
        run: () => revokeAll.mutateAsync(user.id),
      }).catch(settleSensitiveAction),
    suspend: (user: Target) =>
      runSensitive({
        confirm: {
          title: t("detail.suspendTitle"),
          description: t("detail.suspendDescription"),
          confirmLabel: t("detail.suspendConfirm"),
          tone: "destructive",
        },
        actionLabel: t("detail.suspendBtn"),
        run: () => setStatus.mutateAsync({ userId: user.id, status: "suspended" }),
      }).catch(settleSensitiveAction),
    // A toggle the person can flip back, so it isn't confirmed; the backend may ask for a step-up.
    setMfaRequired: (user: Target, required: boolean) =>
      runSensitive({
        actionLabel: t("detail.mfaRequired"),
        run: () => mfaRequired.mutateAsync({ userId: user.id, required }),
      }).catch(settleSensitiveAction),
    // Restores access, so it needs no confirmation.
    reactivate: (user: Target) => setStatus.mutate({ userId: user.id, status: "active" }),
    remove: (user: Target, onDeleted?: () => void) =>
      runSensitive({
        confirm: {
          title: t("detail.deleteTitle"),
          description: t("detail.deleteDescription", { email: user.email ?? "" }),
          confirmLabel: t("detail.deleteConfirm"),
          tone: "destructive",
        },
        actionLabel: t("detail.deleteBtn"),
        run: () => del.mutateAsync(user.id),
      })
        .then(onDeleted)
        .catch(settleSensitiveAction),
  };
}
