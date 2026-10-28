// Removing someone from a group, from its members drawer or its page, through the console's
// confirm, which says what they lose: the roles the group grants (they reach its own members only),
// unless another group or their own roles give the same; they stay in the organisation.
import { useTranslation } from "react-i18next";

import { type Group, type GroupMember, useRemoveGroupMember } from "@/modules/groups/api/groups";
import { useOrgs } from "@/modules/organizations";
import { useTenantId } from "@/platform/auth/session";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

/** `grants`: the roles the group grants, by name; undefined when they can't be read. */
export function useRemoveMember(group: Group | null, grants: readonly string[] | undefined) {
  const { t } = useTranslation("groups");
  const runSensitive = useSensitiveAction();
  const removeM = useRemoveGroupMember();
  const tenantId = useTenantId();
  const org = useOrgs().data?.items.find((item) => item.id === tenantId);

  return (member: GroupMember) => {
    if (!group) return;
    const who = member.display_name?.trim() || member.email;
    const where = org?.name ?? t("membersDrawer.yourOrganisation");
    runSensitive({
      confirm: {
        title: t("membersDrawer.removeTitle", { name: who, group: group.name }),
        description:
          grants === undefined
            ? t("membersDrawer.removeUnknown", { org: where, group: group.name })
            : grants.length
              ? t("membersDrawer.removeLoses", { org: where, roles: grants.join(", ") })
              : t("membersDrawer.removeNoRoles", { org: where, group: group.name }),
        confirmLabel: t("membersDrawer.removeConfirm"),
        tone: "destructive",
      },
      actionLabel: t("membersDrawer.removeAction"),
      run: () => removeM.mutateAsync({ groupId: group.id, userId: member.user_id }),
    }).catch(settleSensitiveAction);
  };
}
