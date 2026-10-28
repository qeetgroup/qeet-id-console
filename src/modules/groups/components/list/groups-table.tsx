import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderPlusIcon,
  PencilIcon,
  TrashIcon,
  UserPlusIcon,
} from "@qeetrix/icons";
import {
  Badge,
  formatDate,
  formatNumber,
  IconButton,
  MenuItem,
  MenuSeparator,
  type TableColumn,
  Text,
} from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { describedAs, type GroupRow, type RolesByGroup } from "@/modules/groups/groups-model";

/**
 * The list's columns: the group (its fold button, its name as a link, one line about it), its
 * members, the roles it grants and when it was made. The table has no tree rows of its own yet
 * (QTRX-25), so the name is the row's link and the fold button sits beside it.
 */
export function useGroupColumns({
  flat,
  open,
  onToggle,
  roles,
}: {
  flat: boolean;
  open: ReadonlySet<string>;
  onToggle: (id: string) => void;
  roles: RolesByGroup;
}): TableColumn<GroupRow>[] {
  const { t } = useTranslation("groups");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  return [
    {
      id: "group",
      header: t("list.columns.group"),
      sortable: true,
      cell: (g) => {
        const inside = g.children.length;
        let line = describedAs(g);
        if (flat || g.continued) line = g.path.length ? g.path.join(" › ") : t("list.row.atTheTop");
        else if (inside) line = t("list.row.groupsInside", { count: g.inside, n: n(g.inside) });
        return (
          <span
            className="grp-cell"
            style={
              flat ? undefined : { paddingInlineStart: `calc(${g.depth} * var(--grp-indent))` }
            }
          >
            {flat ? null : inside ? (
              <IconButton
                icon={open.has(g.id) ? ChevronDownIcon : ChevronRightIcon}
                aria-label={
                  open.has(g.id)
                    ? t("list.row.hide", { name: g.name })
                    : t("list.row.show", { count: g.inside, n: n(g.inside), name: g.name })
                }
                aria-expanded={open.has(g.id)}
                variant="ghost"
                tone="neutral"
                size="sm"
                onClick={() => onToggle(g.id)}
              />
            ) : (
              <span className="grp-leaf" aria-hidden="true" />
            )}
            <span className="grp-two">
              <Link className="grp-name" to="/groups/$groupId" params={{ groupId: g.id }}>
                {g.name}
              </Link>
              {line ? (
                <small className={g.continued ? "is-continued" : undefined}>
                  {g.continued ? t("list.row.continued", { path: line }) : line}
                </small>
              ) : null}
            </span>
          </span>
        );
      },
    },
    {
      id: "members",
      header: t("list.columns.members"),
      numeric: true,
      sortable: true,
      sortFirst: "descending",
      width: 160,
      cell: (g) =>
        g.children.length && !g.member_count ? (
          <span className="grp-two is-end">
            {t("list.row.onlyInItsGroups", { n: n(g.people) })}
          </span>
        ) : (
          <span className="grp-two is-end">
            {g.member_count ? n(g.member_count) : <Text tone="subtle">{t("list.row.noOne")}</Text>}
            {g.people > g.member_count ? (
              <small>{t("list.row.inItsGroups", { n: n(g.people - g.member_count) })}</small>
            ) : null}
          </span>
        ),
    },
    {
      id: "roles",
      header: t("list.columns.roles"),
      width: 200,
      cell: (g) => {
        const granted = roles.get(g.id);
        if (!granted) return null; // still loading, or off this page while the roles load per page
        return granted.length ? (
          <span className="grp-roles">
            {granted.map((name) => (
              <Badge key={name} tone="neutral" size="sm">
                {name}
              </Badge>
            ))}
          </span>
        ) : (
          <Text tone="subtle" aria-label={t("list.row.noRoles")}>
            —
          </Text>
        );
      },
    },
    {
      id: "created",
      header: t("list.columns.created"),
      sortable: true,
      sortFirst: "descending",
      numeric: true,
      width: 120,
      cell: (g) => (
        <time
          className="ppl-nowrap"
          dateTime={g.created_at}
          title={formatDate(g.created_at, locale, { dateStyle: "long" })}
        >
          {new Date(g.created_at).toLocaleDateString(locale, { month: "short", year: "numeric" })}
        </time>
      ),
    },
  ];
}

/** A group's actions: add members, add a group inside, edit, delete. Opening it is its name. */
export function GroupRowActions({
  group,
  onAddMembers,
  onAddInside,
  onEdit,
  onDelete,
}: {
  group: GroupRow;
  onAddMembers: (g: GroupRow) => void;
  onAddInside: (g: GroupRow) => void;
  onEdit: (g: GroupRow) => void;
  onDelete: (g: GroupRow) => void;
}) {
  const { t } = useTranslation("groups");
  return (
    <>
      <MenuItem icon={UserPlusIcon} onClick={() => onAddMembers(group)}>
        {t("list.actions.addMembers")}
      </MenuItem>
      <MenuItem icon={FolderPlusIcon} onClick={() => onAddInside(group)}>
        {t("list.actions.addInside")}
      </MenuItem>
      <MenuItem icon={PencilIcon} onClick={() => onEdit(group)}>
        {t("list.actions.edit")}
      </MenuItem>
      <MenuSeparator />
      <MenuItem icon={TrashIcon} tone="danger" onClick={() => onDelete(group)}>
        {t("list.actions.delete")}
      </MenuItem>
    </>
  );
}
