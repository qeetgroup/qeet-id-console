import { formatDate } from "@qeetrix/react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

import { type Org, useCancelOrgDeletion, useScheduleOrgDeletion } from "./api/orgs";
import { DELETION_GRACE_DAYS, deletionDue } from "./orgs-model";

/**
 * Deleting the organisation you're in, and calling it off. Deleting is the server's: an owner asks,
 * it's deleted DELETION_GRACE_DAYS later, and any owner can keep it until then. The confirm says
 * when and what happens; the server then asks the person to confirm it's them, every time.
 * Suspending isn't offered: the server always refuses it (an organisation can't suspend itself).
 */
export function useOrgActions() {
  const { t } = useTranslation("organizations");
  const runSensitive = useSensitiveAction();
  const schedule = useScheduleOrgDeletion();
  const cancel = useCancelOrgDeletion();

  return {
    pending: schedule.isPending || cancel.isPending,
    remove: (org: Org, members: number) =>
      runSensitive({
        capability: "tenant.write",
        confirm: {
          title: t("page.delete.confirmTitle", { name: org.name }),
          description: t("page.delete.confirmDescription", {
            date: formatDate(deletionDue(Date.now()), formatLocale(), { dateStyle: "long" }),
            days: DELETION_GRACE_DAYS,
            count: members,
            n: members,
          }),
          confirmLabel: t("page.delete.confirm"),
          tone: "destructive",
        },
        actionLabel: t("page.delete.action"),
        run: () => schedule.mutateAsync(org.id),
      }).catch(settleSensitiveAction),
    keep: (org: Org) =>
      runSensitive({
        capability: "tenant.write",
        actionLabel: t("page.delete.keepAction", { name: org.name }),
        run: () => cancel.mutateAsync(org.id),
      }).catch(settleSensitiveAction),
  };
}
