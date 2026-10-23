import { useTranslation } from "react-i18next";

import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

import { type Org, useDeleteOrg, useUpdateOrg } from "./api/orgs";

/**
 * Returns the actions that suspend, reactivate or delete an organization, confirmed and stepped
 * up the same way on the list and the detail page.
 */
export function useOrgActions() {
  const { t } = useTranslation("organizations");
  const runSensitive = useSensitiveAction();
  const update = useUpdateOrg();
  const del = useDeleteOrg();

  return {
    pending: update.isPending || del.isPending,
    // Suspending ends every member's access, so it is confirmed; reactivating restores it.
    toggleSuspend: (org: Org) =>
      org.status === "suspended"
        ? runSensitive({
            capability: "tenant.write",
            actionLabel: t("actionLabels.reactivate"),
            run: () => update.mutateAsync({ id: org.id, body: { status: "active" } }),
          }).catch(settleSensitiveAction)
        : runSensitive({
            capability: "tenant.write",
            confirm: {
              title: t("suspend.title"),
              description: t("suspend.description", { name: org.name }),
              confirmLabel: t("rowActions.suspend"),
              tone: "destructive",
            },
            actionLabel: t("actionLabels.suspend"),
            run: () => update.mutateAsync({ id: org.id, body: { status: "suspended" } }),
          }).catch(settleSensitiveAction),
    remove: (org: Org, onDeleted?: () => void) =>
      runSensitive({
        capability: "tenant.write",
        confirm: {
          title: t("tenants.delete.title"),
          description: t("delete.description", { name: org.name, slug: org.slug }),
          confirmLabel: t("tenants.delete.delete"),
          tone: "destructive",
        },
        actionLabel: t("rowActions.delete"),
        run: () => del.mutateAsync(org.id),
      })
        .then(onDeleted)
        .catch(settleSensitiveAction),
  };
}
