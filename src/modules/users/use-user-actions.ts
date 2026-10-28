import { useTranslation } from "react-i18next";

import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

import { useRevokeAllUserSessions, useSetMfaRequired } from "./api/user360";
import { useDeleteUser, useResetUserMfa, useSetUserStatus } from "./api/users";

type Target = { id: string; email?: string; display_name?: string | null };

/**
 * Returns the actions that take away a person's access, each confirmed and stepped up the same way
 * wherever it is offered: the list, the person's page, the timeline. Each confirmation says what
 * the server does to the person (qeet-id-server internal/identity/users).
 */
export function useUserActions() {
  const { t } = useTranslation("users");
  const runSensitive = useSensitiveAction();
  const resetMfa = useResetUserMfa();
  const revokeAll = useRevokeAllUserSessions();
  const setStatus = useSetUserStatus();
  const del = useDeleteUser();
  const mfaRequired = useSetMfaRequired();
  const nameOf = (user: Target) =>
    user.display_name?.trim() || user.email || t("person.confirm.someone");

  return {
    pending: resetMfa.isPending || revokeAll.isPending || setStatus.isPending || del.isPending,
    pendingAction: {
      resetMfa: resetMfa.isPending,
      revokeSessions: revokeAll.isPending,
      status: setStatus.isPending, // suspend or reactivate
      remove: del.isPending,
      mfaRequired: mfaRequired.isPending,
    },
    // Clears every second step but passkeys, and forgets the remembered devices; sessions stay.
    // The person is emailed.
    resetMfa: (user: Target) =>
      runSensitive({
        confirm: {
          title: t("person.confirm.resetTwoStep.title", { name: nameOf(user) }),
          description: t("person.confirm.resetTwoStep.description"),
          confirmLabel: t("person.confirm.resetTwoStep.button"),
          tone: "destructive",
        },
        actionLabel: t("person.confirm.resetTwoStep.button"),
        run: () => resetMfa.mutateAsync(user.id),
      }).catch(settleSensitiveAction),
    // Ends every session, app sign-in, remembered device and unused link, in every organisation.
    revokeSessions: (user: Target) =>
      runSensitive({
        confirm: {
          title: t("person.confirm.signOut.title", { name: nameOf(user) }),
          description: t("person.confirm.signOut.description"),
          confirmLabel: t("person.confirm.signOut.button"),
          tone: "destructive",
        },
        actionLabel: t("person.confirm.signOut.button"),
        run: () => revokeAll.mutateAsync(user.id),
      }).catch(settleSensitiveAction),
    // Signs them out everywhere too, and stops the API keys they made.
    suspend: (user: Target) =>
      runSensitive({
        confirm: {
          title: t("person.confirm.suspend.title", { name: nameOf(user) }),
          description: t("person.confirm.suspend.description"),
          confirmLabel: t("person.confirm.suspend.button"),
          tone: "destructive",
        },
        actionLabel: t("person.confirm.suspend.button"),
        run: () => setStatus.mutateAsync({ userId: user.id, status: "suspended" }),
      }).catch(settleSensitiveAction),
    // A toggle the person can flip back, so it isn't confirmed; the backend asks for a step-up.
    setMfaRequired: (user: Target, required: boolean) =>
      runSensitive({
        actionLabel: t("person.security.alwaysRequire"),
        run: () => mfaRequired.mutateAsync({ userId: user.id, required }),
      }).catch(settleSensitiveAction),
    // Restores access, so it needs no confirmation.
    reactivate: (user: Target) => setStatus.mutate({ userId: user.id, status: "active" }),
    // A soft delete: the person waits in Deleted, restorable until they're purged.
    remove: (user: Target, onDeleted?: () => void) =>
      runSensitive({
        confirm: {
          title: t("person.confirm.delete.title", { name: nameOf(user) }),
          description: t("person.confirm.delete.description"),
          confirmLabel: t("person.confirm.delete.button"),
          tone: "destructive",
        },
        actionLabel: t("person.confirm.delete.button"),
        run: () => del.mutateAsync(user.id),
      })
        .then(onDeleted)
        .catch(settleSensitiveAction),
  };
}
