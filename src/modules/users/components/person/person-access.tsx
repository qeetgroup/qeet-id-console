import { KeyRoundIcon, PlusIcon, UsersRoundIcon } from "@qeetrix/icons";
import {
  Button,
  formatNumber,
  Link,
  Select,
  Skeleton,
  Table,
  type TableColumn,
  Text,
} from "@qeetrix/react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale, translateDynamic } from "@/i18n";
import { groupRoleQueries, useRoles } from "@/modules/authorization";
import { useAddGroupMember, useGroups, useRemoveGroupMember } from "@/modules/groups";
import { SplitBar } from "@/modules/dashboard";
import { userKeys } from "@/modules/users/api/keys";
import { useUnassignRole } from "@/modules/users/api/person";
import {
  type AccessSummary,
  type UserDetail,
  useUserPermissions,
} from "@/modules/users/api/user360";
import { useAssignRole } from "@/modules/users/api/users";
import { roleLabel } from "@/modules/users/components/people/people-table";
import { type PermissionArea, permissionAreas, personNames } from "@/modules/users/person-model";
import { useTenantId } from "@/platform/auth/session";
import { toastError } from "@/platform/errors/error-toast";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { Fact, Facts, Row, Rows, Section } from "./person-parts";

/** What a permission area is called: Users, API keys, Organisation… or its name in words. */
function areaName(resource: string) {
  return translateDynamic(`users:person.areas.${resource}`);
}

/**
 * Access: what the person can do, and why. The roles given to them directly, the groups they're in
 * (each with the roles it gives its members), and what those add up to, by area.
 */
export function PersonAccess({
  user,
  access,
  loading,
}: {
  user: UserDetail;
  access?: AccessSummary;
  loading: boolean;
}) {
  const { t } = useTranslation("users");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const can = useCapabilities();
  const { first } = personNames(user);
  const org = access?.organization?.name ?? t("person.thisOrg");
  const permissionsQ = useUserPermissions(user.id);
  const areas = permissionAreas(permissionsQ.data?.permissions ?? []);

  if (loading || !access) return <Skeleton lines={8} />;

  const columns: TableColumn<PermissionArea>[] = [
    {
      id: "area",
      header: t("person.access.area"),
      primary: true,
      cell: (a) => <Text weight="medium">{areaName(a.resource)}</Text>,
    },
    {
      id: "can",
      header: t("person.access.can"),
      width: 180,
      cell: (a) =>
        a.everything
          ? t("person.access.everything")
          : a.changes
            ? t("person.access.viewChange")
            : t("person.access.view"),
    },
    {
      id: "permissions",
      header: t("person.access.permissions"),
      cell: (a) => <span className="prs-mono">{a.permissions.join(", ")}</span>,
    },
  ];

  return (
    <div className="prs-page">
      <RolesSection user={user} access={access} org={org} />
      <GroupsSection user={user} access={access} />
      <Section
        title={t("person.access.permissionsHeading")}
        count={n(access.permissions_total)}
        note={
          access.permissions_total
            ? t("person.access.permissionsNote", {
                direct: n(access.permissions_direct),
                inherited: n(access.permissions_inherited),
              })
            : t("person.access.noPermissions", { name: first, org })
        }
      >
        {access.permissions_total ? (
          <div className="prs-perm-split">
            <SplitBar
              label={t("person.can.splitLabel", {
                direct: n(access.permissions_direct),
                inherited: n(access.permissions_inherited),
              })}
              parts={[
                {
                  value: access.permissions_direct,
                  color: "var(--qx-color-dataviz-categorical-1)",
                },
                { value: access.permissions_inherited, color: "var(--qx-color-border-strong)" },
              ]}
            />
          </div>
        ) : null}
        {!can.can("role.read") ? (
          <p className="prs-note">{t("person.access.noRoleRead")}</p>
        ) : permissionsQ.isLoading ? (
          <Skeleton lines={4} />
        ) : areas.length ? (
          <Table<PermissionArea>
            label={t("person.access.permissionsTable", { name: first })}
            rows={areas}
            rowId={(a) => a.resource}
            rowLabel={(a) => areaName(a.resource)}
            columns={columns}
          />
        ) : null}
      </Section>
      <Section title={t("person.access.appsHeading")}>
        <Facts>
          <Fact label={t("person.can.apps")} hint={t("person.can.appsNote", { name: first })}>
            {access.applications_count ? n(access.applications_count) : t("person.signIn.none")}
          </Fact>
          <Fact
            label={t("person.access.policies")}
            hint={t("person.access.policiesNote")}
            action={
              can.can("policy.read") ? (
                <Button variant="ghost" size="sm" render={<RouterLink to="/authorization/abac" />}>
                  {t("person.access.seePolicies")}
                </Button>
              ) : undefined
            }
          >
            {t("person.access.policiesCount", {
              count: access.policies_count,
              n: n(access.policies_count),
              org,
            })}
          </Fact>
        </Facts>
      </Section>
    </div>
  );
}

/** The roles given to the person directly: give another, or take one away. */
function RolesSection({
  user,
  access,
  org,
}: {
  user: UserDetail;
  access: AccessSummary;
  org: string;
}) {
  const { t } = useTranslation("users");
  const can = useCapabilities();
  const canGrant = can.can("user.write") && can.can("role.write") && can.can("role.read");
  const runSensitive = useSensitiveAction();
  const roles = useRoles();
  const assignM = useAssignRole();
  const unassignM = useUnassignRole();
  const [roleId, setRoleId] = useState("");
  const { full, first } = personNames(user);
  const given = new Set(access.roles.map((r) => r.id));
  const grantable = (roles.data?.items ?? []).filter((r) => !given.has(r.id));

  const give = () => {
    const role = grantable.find((r) => r.id === roleId);
    if (!role) return;
    void runSensitive({
      actionLabel: t("person.access.give"),
      run: () => assignM.mutateAsync({ userId: user.id, roleId: role.id }),
    })
      .then(() => setRoleId(""))
      .catch(settleSensitiveAction);
  };

  const take = (role: { id: string; name: string }) =>
    void runSensitive({
      confirm: {
        title: t("person.confirm.takeRole.title", { role: roleLabel(t, role.name), name: full }),
        description: t("person.confirm.takeRole.description", { role: roleLabel(t, role.name) }),
        confirmLabel: t("person.confirm.takeRole.button"),
        tone: "destructive",
      },
      actionLabel: t("person.confirm.takeRole.button"),
      run: () => unassignM.mutateAsync({ userId: user.id, roleId: role.id }),
    }).catch(settleSensitiveAction);

  return (
    <Section
      title={t("person.access.rolesHeading")}
      count={access.roles.length}
      note={t("person.access.rolesNote", { name: first, org })}
      action={
        canGrant ? (
          <>
            <Select
              aria-label={t("person.access.chooseRole")}
              className="prs-pick"
              value={roleId}
              onValueChange={(value) => setRoleId(String(value ?? ""))}
              items={[
                {
                  value: "",
                  label: grantable.length
                    ? t("person.access.chooseRole")
                    : t("person.access.allRoles"),
                },
                ...grantable.map((r) => ({ value: r.id, label: roleLabel(t, r.name) })),
              ]}
            />
            <Button
              variant="soft"
              size="sm"
              icon={KeyRoundIcon}
              disabled={!roleId}
              loading={assignM.isPending}
              onClick={give}
            >
              {t("person.access.give")}
            </Button>
          </>
        ) : undefined
      }
    >
      {access.roles.length ? (
        <Rows label={t("person.access.rolesHeading")}>
          {access.roles.map((r) => (
            <Row
              key={r.id}
              icon={KeyRoundIcon}
              name={roleLabel(t, r.name)}
              line={r.description || undefined}
              end={
                canGrant ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t("person.access.takeLabel", { role: roleLabel(t, r.name) })}
                    disabled={unassignM.isPending}
                    onClick={() => take(r)}
                  >
                    {t("person.access.take")}
                  </Button>
                ) : undefined
              }
            />
          ))}
        </Rows>
      ) : (
        <p className="prs-note">{t("person.can.noRole", { name: first })}</p>
      )}
    </Section>
  );
}

/** The groups the person is in, each with the roles it gives them: add to one, or leave one. */
function GroupsSection({ user, access }: { user: UserDetail; access: AccessSummary }) {
  const { t } = useTranslation("users");
  const can = useCapabilities();
  const tenantId = useTenantId();
  const canChange = can.can("group.write");
  const canReadRoles = can.can("role.read");
  const runSensitive = useSensitiveAction();
  const qc = useQueryClient();
  const groupsQ = useGroups();
  const addM = useAddGroupMember();
  const removeM = useRemoveGroupMember();
  const [groupId, setGroupId] = useState("");
  const { full, first } = personNames(user);
  const all = groupsQ.data?.items ?? [];
  const byId = new Map(all.map((g) => [g.id, g]));
  const inIds = new Set(access.groups.map((g) => g.id));
  const joinable = all.filter((g) => !inIds.has(g.id)).sort((a, b) => a.name.localeCompare(b.name));
  const roleQs = useQueries({
    queries: canReadRoles ? access.groups.map((g) => groupRoleQueries.list(tenantId, g.id)) : [],
  });

  const pathOf = (id: string) => {
    const names: string[] = [];
    let parent = byId.get(id)?.parent_id;
    while (parent && names.length < 8) {
      const p = byId.get(parent);
      if (!p) break;
      names.unshift(p.name);
      parent = p.parent_id;
    }
    return names.join(" › ");
  };

  // The group hooks refresh the group; the person's own views need it too.
  const refresh = () => void qc.invalidateQueries({ queryKey: userKeys.user(tenantId, user.id) });
  const add = () => {
    const group = joinable.find((g) => g.id === groupId);
    if (!group) return;
    void runSensitive({
      actionLabel: t("person.access.addToGroup"),
      // The hook doesn't toast a failure (the group page shows its own), so it's said here.
      run: () =>
        addM.mutateAsync(
          { groupId: group.id, userId: user.id },
          {
            onError: (err) => toastError(err, t("person.access.addFailed", { group: group.name })),
          },
        ),
    })
      .then(() => {
        setGroupId("");
        refresh();
      })
      .catch(settleSensitiveAction);
  };

  const leave = (group: { id: string; name: string }) =>
    void runSensitive({
      confirm: {
        title: t("person.confirm.leaveGroup.title", { name: full, group: group.name }),
        description: t("person.confirm.leaveGroup.description", { group: group.name }),
        confirmLabel: t("person.confirm.leaveGroup.button"),
        tone: "destructive",
      },
      actionLabel: t("person.confirm.leaveGroup.button"),
      run: () => removeM.mutateAsync({ groupId: group.id, userId: user.id }),
    })
      .then(refresh)
      .catch(settleSensitiveAction);

  return (
    <Section
      title={t("person.access.groupsHeading")}
      count={access.groups.length}
      note={t("person.access.groupsNote")}
      action={
        canChange ? (
          <>
            <Select
              aria-label={t("person.access.chooseGroup")}
              className="prs-pick"
              value={groupId}
              onValueChange={(value) => setGroupId(String(value ?? ""))}
              items={[
                {
                  value: "",
                  label: joinable.length
                    ? t("person.access.chooseGroup")
                    : t("person.access.inEveryGroup"),
                },
                ...joinable.map((g) => ({
                  value: g.id,
                  label: pathOf(g.id) ? `${pathOf(g.id)} › ${g.name}` : g.name,
                })),
              ]}
            />
            <Button
              variant="soft"
              size="sm"
              icon={PlusIcon}
              disabled={!groupId}
              loading={addM.isPending}
              onClick={add}
            >
              {t("person.access.addToGroup")}
            </Button>
          </>
        ) : undefined
      }
    >
      {access.groups.length ? (
        <Rows label={t("person.access.groupsHeading")}>
          {access.groups.map((g, i) => {
            const gives = roleQs[i]?.data?.items;
            const path = pathOf(g.id);
            return (
              <Row
                key={g.id}
                icon={UsersRoundIcon}
                name={
                  can.can("group.read") ? (
                    <Link render={<RouterLink to="/groups/$groupId" params={{ groupId: g.id }} />}>
                      {g.name}
                    </Link>
                  ) : (
                    g.name
                  )
                }
                line={[
                  path || null,
                  gives
                    ? gives.length
                      ? t("person.access.gives", {
                          roles: gives.map((r) => roleLabel(t, r.name)).join(", "),
                        })
                      : t("person.access.givesNothing")
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                end={
                  canChange ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t("person.access.leaveLabel", { group: g.name })}
                      disabled={removeM.isPending}
                      onClick={() => leave(g)}
                    >
                      {t("person.access.leave")}
                    </Button>
                  ) : undefined
                }
              />
            );
          })}
        </Rows>
      ) : (
        <p className="prs-note">{t("person.access.noGroupsYet", { name: first })}</p>
      )}
    </Section>
  );
}
