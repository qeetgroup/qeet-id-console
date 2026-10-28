import {
  EllipsisIcon,
  FolderPlusIcon,
  PencilIcon,
  TrashIcon,
  UserPlusIcon,
  UsersRoundIcon,
} from "@qeetrix/icons";
import {
  Button,
  formatDate,
  formatNumber,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Skeleton,
} from "@qeetrix/react";
import {
  Breadcrumb,
  BreadcrumbItem,
  EmptyState,
  PageContent,
  PageHeader,
} from "@qeetrix/react/experimental";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { useGroupRoles, useRoles } from "@/modules/authorization";
import { useGroupMembers, useGroups } from "@/modules/groups/api/groups";
import { GroupDrawer } from "@/modules/groups/components/group-drawer";
import { GroupMembersDrawer } from "@/modules/groups/components/group-members-drawer";
import { describedAs, everyGroup, groupTree } from "@/modules/groups/groups-model";
import { useDeleteGroupFlow } from "@/modules/groups/use-delete-group";
import { useRemoveMember } from "@/modules/groups/use-remove-member";
import { userQueries } from "@/modules/users";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import { GroupFamily } from "./group-family";
import {
  DetailsSection,
  InsideSection,
  MembersTable,
  RolesSection,
  Section,
} from "./group-sections";
import "./group-page.css";

/**
 * A group's page: its facts in the header (members, the roles it grants, where it sits, when it was
 * made), then ruled sections: where it sits (its family, as a picture), its members, the roles it
 * grants (its own members get them), the groups inside it, and its details. Adding members, editing,
 * adding a group inside and deleting use the list's drawers and confirm.
 */
export function GroupPage({ groupId }: { groupId: string }) {
  const { t } = useTranslation(["groups", "dashboard"]);
  const n = (value: number) => formatNumber(value, formatLocale());
  const locale = formatLocale();
  const access = useCapabilities();
  const canWrite = access.can("group.write");
  const canReadRoles = access.can("role.read");
  const canGrant = canReadRoles && access.can("role.write");
  const tenantId = useTenantId();
  const navigate = useNavigate();

  const groupsQ = useGroups();
  const groups = groupsQ.data?.items ?? [];
  const all = useMemo(() => everyGroup(groupTree(groups)), [groups]);
  const group = all.find((g) => g.id === groupId);
  const parent = group?.parent_id ? all.find((g) => g.id === group.parent_id) : undefined;
  const parents = useMemo(() => {
    const out = [];
    let p = parent;
    while (p) {
      out.unshift(p);
      const up = p.parent_id;
      p = up ? all.find((g) => g.id === up) : undefined;
    }
    return out;
  }, [parent, all]);

  const membersQ = useGroupMembers(groupId);
  const rolesQ = useGroupRoles(canReadRoles ? groupId : "");
  const allRoles = useRoles().data?.items ?? [];
  const directory = useQuery({
    ...userQueries.directory(tenantId),
    enabled: access.can("user.read") && !!tenantId,
  });
  const people = useMemo(
    () => new Map((directory.data?.items ?? []).map((u) => [u.id, u])),
    [directory.data],
  );
  const granted = rolesQ.data?.items ?? [];
  const grants = canReadRoles && rolesQ.data ? granted.map((r) => r.name) : undefined;
  const members = membersQ.data?.items ?? [];

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [creatingInside, setCreatingInside] = useState(false);
  const remove = useDeleteGroupFlow(groups);
  const removeMember = useRemoveMember(group ?? null, grants);

  if (groupsQ.isLoading)
    return (
      <PageContent>
        <Skeleton lines={6} />
      </PageContent>
    );
  if (!group)
    return (
      <PageContent>
        <EmptyState
          icon={UsersRoundIcon}
          title={t("page.notFound")}
          description={t("page.notFoundDescription")}
          actions={
            <Button render={<Link to="/groups" />} variant="soft">
              {t("page.backToGroups")}
            </Button>
          }
        />
      </PageContent>
    );

  const suspended = members.filter((m) => people.get(m.user_id)?.status === "suspended").length;
  const inItsGroups = group.people - group.member_count;

  return (
    <>
      <PageHeader
        breadcrumb={
          <Breadcrumb label={t("dashboard:frame.breadcrumb")}>
            <BreadcrumbItem>{t("page.directory")}</BreadcrumbItem>
            <BreadcrumbItem href="/groups" render={<Link to="/groups" />}>
              {t("list.title")}
            </BreadcrumbItem>
            {parents.map((p) => (
              <BreadcrumbItem
                key={p.id}
                href={`/groups/${p.id}`}
                render={<Link to="/groups/$groupId" params={{ groupId: p.id }} />}
              >
                {p.name}
              </BreadcrumbItem>
            ))}
          </Breadcrumb>
        }
        title={group.name}
        description={describedAs(group) ?? undefined}
        actions={
          canWrite ? (
            <>
              <Menu>
                <MenuTrigger
                  render={
                    <IconButton
                      icon={EllipsisIcon}
                      aria-label={t("list.moreActions")}
                      variant="ghost"
                      tone="neutral"
                    />
                  }
                />
                <MenuContent align="end">
                  <MenuItem icon={PencilIcon} onClick={() => setEditing(true)}>
                    {t("list.actions.edit")}
                  </MenuItem>
                  <MenuItem icon={FolderPlusIcon} onClick={() => setCreatingInside(true)}>
                    {t("list.actions.addInside")}
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem
                    icon={TrashIcon}
                    tone="danger"
                    onClick={() => remove(group, () => void navigate({ to: "/groups" }))}
                  >
                    {t("page.delete", { name: group.name })}
                  </MenuItem>
                </MenuContent>
              </Menu>
              <Button icon={UserPlusIcon} onClick={() => setAdding(true)}>
                {t("page.addMembers")}
              </Button>
            </>
          ) : undefined
        }
        summary={
          <dl className="ppl-band grp-page-band">
            <div className="ppl-cell">
              <dt className="ppl-label">{t("page.band.members")}</dt>
              <dd className="ppl-value">{n(group.member_count)}</dd>
              <dd className={suspended ? "ppl-note is-warning" : "ppl-note"}>
                {[
                  suspended
                    ? t("page.band.suspended", { n: n(suspended) })
                    : group.member_count
                      ? t("page.band.allActive")
                      : t("page.band.noOne"),
                  inItsGroups ? t("list.row.inItsGroups", { n: n(inItsGroups) }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </dd>
            </div>
            {canReadRoles ? (
              <div className="ppl-cell">
                <dt className="ppl-label">{t("page.band.grants")}</dt>
                <dd className="ppl-value">
                  {granted.length ? granted.map((r) => r.name).join(", ") : t("page.band.none")}
                </dd>
                <dd
                  className={
                    granted.length && !group.member_count ? "ppl-note is-warning" : "ppl-note"
                  }
                >
                  {granted.length
                    ? group.member_count
                      ? t("page.band.toMembers", {
                          count: group.member_count,
                          n: n(group.member_count),
                        })
                      : t("page.band.toNoOne")
                    : t("page.band.grantBelow")}
                </dd>
              </div>
            ) : null}
            <div className="ppl-cell">
              <dt className="ppl-label">{t("page.band.inside")}</dt>
              <dd className="ppl-value">{parent ? parent.name : t("drawer.atTheTop")}</dd>
              <dd className="ppl-note">
                {parent
                  ? t("page.band.groupsInIt", {
                      count: parent.children.length,
                      n: n(parent.children.length),
                    })
                  : t("page.band.groupsInsideIt", { count: group.inside, n: n(group.inside) })}
              </dd>
            </div>
            <div className="ppl-cell">
              <dt className="ppl-label">{t("page.band.created")}</dt>
              <dd className="ppl-value">
                {new Date(group.created_at).toLocaleDateString(locale, {
                  month: "short",
                  year: "numeric",
                })}
              </dd>
              <dd className="ppl-note">
                {formatDate(group.created_at, locale, { dateStyle: "long" })}
              </dd>
            </div>
          </dl>
        }
      />
      <PageContent>
        <div className="grp-page">
          <Section
            id="grp-page-where"
            title={t("page.family.heading")}
            note={t("page.family.note")}
          >
            <GroupFamily group={group} parent={parent} />
          </Section>
          <Section
            id="grp-page-members"
            title={t("page.members.heading")}
            count={members.length}
            action={
              canWrite && members.length ? (
                <Button
                  variant="soft"
                  size="sm"
                  icon={UserPlusIcon}
                  onClick={() => setAdding(true)}
                >
                  {t("page.addMembers")}
                </Button>
              ) : undefined
            }
          >
            <MembersTable
              group={group}
              members={members}
              people={people}
              onRemove={removeMember}
              loading={membersQ.isLoading}
              error={membersQ.isError ? membersQ.error : undefined}
              onRetry={() => membersQ.refetch()}
              onAdd={() => setAdding(true)}
              canWrite={canWrite}
              grants={grants}
            />
          </Section>
          {canReadRoles ? (
            <RolesSection
              group={group}
              granted={granted}
              roles={allRoles}
              canGrant={canGrant}
              loading={rolesQ.isLoading}
            />
          ) : null}
          <InsideSection
            group={group}
            canWrite={canWrite}
            onAddInside={() => setCreatingInside(true)}
          />
          <DetailsSection group={group} />
        </div>
      </PageContent>

      {canWrite ? (
        <>
          <GroupMembersDrawer
            group={adding ? group : null}
            onClose={() => setAdding(false)}
            path={[...group.path, group.name]}
            grants={grants}
            people={directory.data?.items ?? []}
          />
          <GroupDrawer
            open={editing || creatingInside}
            onOpenChange={(o) => {
              if (o) return;
              setEditing(false);
              setCreatingInside(false);
            }}
            groups={groups}
            people={directory.data?.items}
            group={editing ? group : null}
            parentId={creatingInside ? group.id : undefined}
          />
        </>
      ) : null}
    </>
  );
}
