// Deleting a group, from the list or its page, through the console's confirm. The server deletes the
// groups inside it too (their parent link cascades), and with them every membership and every role
// they grant; the people stay in the organisation. The confirm says all of that.
import { formatNumber } from "@qeetrix/react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { type Group, useDeleteGroup } from "@/modules/groups/api/groups";
import { everyGroup, groupTree } from "@/modules/groups/groups-model";
import { useOrgs } from "@/modules/organizations";
import { useTenantId } from "@/platform/auth/session";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

/** Returns `remove(group, onDeleted?)`, which confirms, deletes and then calls `onDeleted`. */
export function useDeleteGroupFlow(groups: readonly Group[]) {
  const { t } = useTranslation("groups");
  const runSensitive = useSensitiveAction();
  const deleteM = useDeleteGroup();
  const tenantId = useTenantId();
  const org = useOrgs().data?.items.find((item) => item.id === tenantId);
  const n = (value: number) => formatNumber(value, formatLocale());

  return (group: Group, onDeleted?: () => void) => {
    const node = everyGroup(groupTree(groups)).find((g) => g.id === group.id);
    const inside = node?.inside ?? 0;
    const where = org?.name ?? t("confirm.yourOrganisation");
    const names = node?.children.slice(0, 3).map((c) => c.name) ?? [];
    const more = (node?.children.length ?? 0) - names.length;
    const description = inside
      ? t("confirm.deleteWithGroups", {
          count: inside,
          n: n(inside),
          names: more
            ? t("confirm.namesAndMore", { names: names.join(", "), n: n(more) })
            : names.join(", "),
          org: where,
        })
      : group.member_count
        ? t("confirm.deleteWithMembers", {
            count: group.member_count,
            n: n(group.member_count),
            org: where,
          })
        : t("confirm.deleteEmpty");
    runSensitive({
      confirm: {
        title: t("confirm.deleteTitle", { name: group.name }),
        description,
        confirmLabel: inside
          ? t("confirm.deleteGroups", { count: inside + 1, n: n(inside + 1) })
          : t("confirm.deleteGroup"),
        tone: "destructive",
      },
      actionLabel: t("confirm.deleteAction"),
      run: () => deleteM.mutateAsync(group.id),
    })
      // Cancelling or a failure rejects, so this runs only once it's deleted.
      .then(() => onDeleted?.())
      .catch(settleSensitiveAction);
  };
}
