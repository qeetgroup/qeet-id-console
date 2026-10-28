import {
  FolderPlusIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserMinusIcon,
  UserPlusIcon,
} from "@qeetrix/icons";
import {
  Badge,
  Button,
  formatDate,
  formatNumber,
  IconButton,
  MenuItem,
  Select,
  Table,
  type TableColumn,
  Text,
} from "@qeetrix/react";
import { AvatarItem, CopyButton, DataState, EmptyState } from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import {
  type GroupRole,
  type Role,
  useGrantGroupRole,
  useRevokeGroupRole,
} from "@/modules/authorization";
import type { GroupMember } from "@/modules/groups/api/groups";
import type { GroupNode } from "@/modules/groups/groups-model";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

/** A ruled section: its heading, an action at the end, then what it holds. */
export function Section({
  id,
  title,
  count,
  action,
  note,
  children,
}: {
  id: string;
  title: string;
  count?: number;
  action?: ReactNode;
  note?: string;
  children: ReactNode;
}) {
  const n = (value: number) => formatNumber(value, formatLocale());
  return (
    <section className="grp-page-section" aria-labelledby={id}>
      <div className="grp-page-head">
        <h2 id={id} className="grp-page-title">
          {title}
          {count !== undefined ? <span className="grp-page-count"> {n(count)}</span> : null}
        </h2>
        {action}
      </div>
      {note ? <p className="grp-page-note">{note}</p> : null}
      {children}
    </section>
  );
}

export type MemberPerson = {
  id: string;
  status?: string;
  groups_count?: number;
  metadata?: Record<string, unknown> | null;
};

/** Who's in it: a person, their title, how many other groups they're in; Remove on each row. */
export function MembersTable({
  group,
  members,
  people,
  onRemove,
  loading,
  error,
  onRetry,
  onAdd,
  canWrite,
  grants,
}: {
  group: GroupNode;
  members: GroupMember[];
  people: ReadonlyMap<string, MemberPerson>;
  onRemove: (m: GroupMember) => void;
  loading: boolean;
  error?: unknown;
  onRetry: () => void;
  onAdd: () => void;
  canWrite: boolean;
  grants?: readonly string[];
}) {
  const { t } = useTranslation("groups");
  const n = (value: number) => formatNumber(value, formatLocale());
  const nameOf = (m: GroupMember) => m.display_name?.trim() || m.email;
  const columns: TableColumn<GroupMember>[] = [
    {
      id: "person",
      header: t("page.members.person"),
      primary: true,
      cell: (m) => (
        <span className="ppl-person">
          <AvatarItem name={nameOf(m)} description={m.email} />
          {people.get(m.user_id)?.status === "suspended" ? (
            <Badge tone="warning" size="sm">
              {t("membersDrawer.suspended")}
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      id: "title",
      header: t("page.members.title"),
      cell: (m) => {
        const title = people.get(m.user_id)?.metadata?.title;
        return typeof title === "string" && title.trim() ? title : <Text tone="subtle">—</Text>;
      },
    },
    {
      id: "others",
      header: t("page.members.others"),
      numeric: true,
      width: 150,
      cell: (m) => {
        const count = people.get(m.user_id)?.groups_count;
        if (count === undefined) return <Text tone="subtle">—</Text>;
        const others = Math.max(0, count - 1);
        return others ? (
          t("page.members.more", { n: n(others) })
        ) : (
          <Text tone="subtle">{t("page.members.none")}</Text>
        );
      },
    },
  ];
  return (
    <DataState loading={loading} error={error} onRetry={onRetry}>
      {members.length ? (
        <Table<GroupMember>
          label={t("page.members.heading")}
          rows={[...members].sort((a, b) => nameOf(a).localeCompare(nameOf(b)))}
          rowId={(m) => m.user_id}
          rowLabel={nameOf}
          columns={columns}
          rowActions={
            canWrite
              ? (m) => (
                  <MenuItem icon={UserMinusIcon} tone="danger" onClick={() => onRemove(m)}>
                    {t("page.members.remove", { group: group.name })}
                  </MenuItem>
                )
              : undefined
          }
        />
      ) : (
        <EmptyState
          size="section"
          icon={UserPlusIcon}
          title={t("membersDrawer.emptyTitle", { name: group.name })}
          description={
            grants?.length
              ? t("membersDrawer.emptyGrants", { count: grants.length, roles: grants.join(", ") })
              : t("page.members.emptyHelp")
          }
          actions={
            canWrite ? (
              <Button icon={UserPlusIcon} onClick={onAdd}>
                {t("page.addMembers")}
              </Button>
            ) : undefined
          }
        />
      )}
    </DataState>
  );
}

/**
 * The roles it grants: each with what it's for and when it was granted, and a way to stop granting
 * it (confirmed); a role to grant at the head. Both go through the step-up: they change what every
 * member can do.
 */
export function RolesSection({
  group,
  granted,
  roles,
  canGrant,
  loading,
}: {
  group: GroupNode;
  granted: GroupRole[];
  roles: Role[];
  canGrant: boolean;
  loading: boolean;
}) {
  const { t } = useTranslation("groups");
  const locale = formatLocale();
  const runSensitive = useSensitiveAction();
  const grantM = useGrantGroupRole(group.id);
  const revokeM = useRevokeGroupRole(group.id);
  const [roleId, setRoleId] = useState("");
  const grantedIds = new Set(granted.map((r) => r.role_id));
  const grantable = roles.filter((r) => !grantedIds.has(r.id) && r.name !== "owner");
  const about = new Map(roles.map((r) => [r.id, r.description]));

  const grant = () =>
    roleId &&
    runSensitive({
      actionLabel: t("page.roles.grantAction"),
      run: () => grantM.mutateAsync(roleId),
    })
      .then(() => setRoleId(""))
      .catch(settleSensitiveAction);
  const revoke = (role: GroupRole) =>
    runSensitive({
      confirm: {
        title: t("page.roles.stopTitle", { role: role.name, group: group.name }),
        description: group.member_count
          ? t("page.roles.stopDescription", {
              role: role.name,
              count: group.member_count,
              n: formatNumber(group.member_count, locale),
            })
          : t("page.roles.stopDescriptionEmpty", { role: role.name }),
        confirmLabel: t("page.roles.stopConfirm"),
        tone: "destructive",
      },
      actionLabel: t("page.roles.stopAction"),
      run: () => revokeM.mutateAsync(role.role_id),
    }).catch(settleSensitiveAction);

  return (
    <Section
      id="grp-page-roles"
      title={t("page.roles.heading")}
      note={t("page.roles.note")}
      action={
        canGrant ? (
          <span className="grp-page-grant">
            <Select
              aria-label={t("page.roles.choose")}
              className="grp-page-grant-select"
              value={roleId}
              onValueChange={(value) => setRoleId(String(value ?? ""))}
              items={[
                {
                  value: "",
                  label: grantable.length ? t("page.roles.choose") : t("page.roles.allGranted"),
                },
                ...grantable.map((r) => ({ value: r.id, label: r.name })),
              ]}
            />
            <Button
              variant="soft"
              size="sm"
              icon={ShieldCheckIcon}
              disabled={!roleId}
              loading={grantM.isPending}
              onClick={() => void grant()}
            >
              {t("page.roles.grant")}
            </Button>
          </span>
        ) : undefined
      }
    >
      <DataState loading={loading}>
        {granted.length ? (
          <ul className="grp-page-rows">
            {granted.map((r) => (
              <li key={r.role_id} className="grp-page-row">
                <span className="grp-page-two">
                  <strong>{r.name}</strong>
                  {about.get(r.role_id) ? <small>{about.get(r.role_id)}</small> : null}
                </span>
                <small className="grp-page-when">
                  {t("page.roles.granted", {
                    date: formatDate(r.granted_at, locale, { dateStyle: "medium" }),
                  })}
                </small>
                {canGrant ? (
                  <IconButton
                    icon={TrashIcon}
                    aria-label={t("page.roles.stop", { role: r.name })}
                    tooltip={t("page.roles.stopTooltip")}
                    variant="ghost"
                    tone="neutral"
                    size="sm"
                    onClick={() => revoke(r)}
                  />
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="grp-page-empty">{t("page.roles.none")}</p>
        )}
      </DataState>
    </Section>
  );
}

/** The groups inside it, each with its members and a link to its page. */
export function InsideSection({
  group,
  canWrite,
  onAddInside,
}: {
  group: GroupNode;
  canWrite: boolean;
  onAddInside: () => void;
}) {
  const { t } = useTranslation("groups");
  const n = (value: number) => formatNumber(value, formatLocale());
  return (
    <Section
      id="grp-page-inside"
      title={t("page.inside.heading")}
      count={group.children.length}
      action={
        canWrite ? (
          <Button variant="ghost" size="sm" icon={FolderPlusIcon} onClick={onAddInside}>
            {t("list.actions.addInside")}
          </Button>
        ) : undefined
      }
    >
      {group.children.length ? (
        <ul className="grp-page-rows">
          {group.children.map((g) => (
            <li key={g.id} className="grp-page-row">
              <Link className="grp-page-link" to="/groups/$groupId" params={{ groupId: g.id }}>
                {g.name}
              </Link>
              <small className="grp-page-when">
                {g.member_count
                  ? t("page.inside.members", { count: g.member_count, n: n(g.member_count) })
                  : t("list.row.noOne")}
                {g.children.length
                  ? ` · ${t("list.row.groupsInside", { count: g.inside, n: n(g.inside) })}`
                  : ""}
              </small>
              <span />
            </li>
          ))}
        </ul>
      ) : (
        <p className="grp-page-empty">{t("page.inside.none")}</p>
      )}
    </Section>
  );
}

/** Its ID, to copy, and when it was made. */
export function DetailsSection({ group }: { group: GroupNode }) {
  const { t } = useTranslation("groups");
  const locale = formatLocale();
  return (
    <Section id="grp-page-details" title={t("page.details.heading")}>
      <dl className="grp-page-facts">
        <div className="grp-page-fact">
          <dt>{t("page.details.id")}</dt>
          <dd>
            <code>{group.id}</code>
            <CopyButton value={group.id} label={t("page.details.copyId")} size="sm" />
          </dd>
        </div>
        <div className="grp-page-fact">
          <dt>{t("page.details.made")}</dt>
          <dd>{formatDate(group.created_at, locale, { dateStyle: "long" })}</dd>
        </div>
      </dl>
    </Section>
  );
}
