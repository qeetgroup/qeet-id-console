import { formatNumber } from "@qeetrix/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { formatLocale } from "@/i18n";
import { errorMessage } from "@/platform/errors/user-message";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import {
  useDeleteLdapConnection,
  useRevokeScimToken,
  useSetLdapStatus,
  useTestLdapConnection,
} from "./api/connection-actions";
import { hostOf } from "./connections-model";
import type { DirectoryConnection } from "./directory-model";

/**
 * A connection's actions from the list. Each confirm says what happens to people (the server's
 * behaviour): deleting an LDAP connection keeps their accounts, groups and roles, but they can't
 * sign in with it; revoking the SCIM token stops the identity provider's changes, and the people it
 * made stay. Turning a directory off is confirmed too: no one can sign in with it until it's on.
 */
export function useConnectionActions() {
  const { t } = useTranslation("directory");
  const runSensitive = useSensitiveAction();
  const testM = useTestLdapConnection();
  const statusM = useSetLdapStatus();
  const deleteM = useDeleteLdapConnection();
  const revokeM = useRevokeScimToken();

  return {
    pending: testM.isPending || statusM.isPending || deleteM.isPending || revokeM.isPending,
    test: (c: DirectoryConnection) =>
      testM.mutateAsync(c.id).then(
        () => toast.success(t("connections.toast.testPassed", { name: c.name })),
        (err: unknown) =>
          toast.error(t("connections.toast.testFailed", { name: c.name }), {
            description: errorMessage(err),
          }),
      ),
    setOn: (c: DirectoryConnection, on: boolean) =>
      runSensitive({
        capability: "connection.write",
        confirm: on
          ? undefined
          : {
              title: t("connections.off.title", { name: c.name }),
              description: t("connections.off.description", { host: hostOf(c.serverUrl) }),
              confirmLabel: t("connections.off.confirm"),
              tone: "default",
            },
        actionLabel: on ? t("connections.actions.turnOn") : t("connections.actions.turnOff"),
        run: () =>
          statusM
            .mutateAsync({ id: c.id, on })
            .then(() =>
              toast.success(
                on
                  ? t("connections.toast.on", { name: c.name })
                  : t("connections.toast.off", { name: c.name }),
              ),
            ),
      }).catch(settleSensitiveAction),
    remove: (c: DirectoryConnection) =>
      runSensitive({
        capability: "connection.write",
        confirm: {
          title: t("connections.delete.title", { name: c.name }),
          description: t("connections.delete.description", { host: hostOf(c.serverUrl) }),
          confirmLabel: t("connections.delete.confirm"),
          tone: "destructive",
        },
        actionLabel: t("connections.delete.action"),
        run: () =>
          deleteM
            .mutateAsync(c.id)
            .then(() => toast.success(t("connections.toast.deleted", { name: c.name }))),
      }).catch(settleSensitiveAction),
    revoke: (c: DirectoryConnection) =>
      runSensitive({
        capability: "connection.write",
        confirm: {
          title: t("connections.revoke.title"),
          description: t("connections.revoke.description", {
            count: c.userCount ?? 0,
            n: formatNumber(c.userCount ?? 0, formatLocale()),
          }),
          confirmLabel: t("connections.revoke.confirm"),
          tone: "destructive",
        },
        actionLabel: t("connections.revoke.action"),
        run: () => revokeM.mutateAsync(),
      }).catch(settleSensitiveAction),
  };
}
