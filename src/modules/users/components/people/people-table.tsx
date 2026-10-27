import {
  KeyRoundIcon,
  LockKeyholeIcon,
  LogOutIcon,
  MailQuestionMarkIcon,
  PencilIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
  TrashIcon,
  UserCheckIcon,
  UserXIcon,
  UsersRoundIcon,
} from "@qeetrix/icons";
import {
  Badge,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSubmenu,
  MenuSubmenuTrigger,
  type TableColumn,
  Text,
} from "@qeetrix/react";
import { AvatarItem } from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { User } from "@/modules/users/api/users";
import { isAdmin, personName, recency } from "@/modules/users/people-model";
import type { useUserActions } from "@/modules/users/use-user-actions";
import { GroupItems, type usePeopleRun } from "./people-bulk";

/** A role as the list names it: the built-in `owner` in words, the rest as the organisation named them. */
export function roleLabel(t: TFunction<"users">, role: string) {
  return role === "owner" ? t("people.roles.owner") : role;
}

/** The list's columns: who, their role, how they sign in, when they were last active, and when they joined. */
export function usePeopleColumns(currentUserId: string | null, now: number): TableColumn<User>[] {
  const { t } = useTranslation("users");
  const locale = formatLocale();
  return [
    {
      id: "person",
      header: t("people.columns.person"),
      primary: true,
      sortable: true,
      cell: (u) => (
        <span className="ppl-person">
          <AvatarItem name={personName(u)} description={u.email} src={u.avatar_url ?? undefined} />
          {u.id === currentUserId ? (
            <Badge tone="brand" size="sm">
              {t("list.you")}
            </Badge>
          ) : null}
          {u.status === "suspended" ? (
            <Badge tone="warning" size="sm">
              {t("status.suspended")}
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      id: "role",
      header: t("people.columns.role"),
      sortable: true,
      cell: (u) =>
        u.roles?.length ? (
          u.roles.map((role) => roleLabel(t, role)).join(", ")
        ) : (
          <Text tone="subtle">{t("people.noRole")}</Text>
        ),
    },
    {
      id: "signin",
      header: t("people.columns.signIn"),
      cell: (u) => (
        <span className="ppl-signin">
          {u.mfa_enabled ? (
            <span className="ppl-flag is-ok">
              <ShieldCheckIcon aria-hidden="true" />
              {t("people.signIn.on")}
            </span>
          ) : (
            <span className={isAdmin(u) ? "ppl-flag is-danger" : "ppl-flag is-warning"}>
              <ShieldOffIcon aria-hidden="true" />
              {isAdmin(u) ? t("people.signIn.offAdmin") : t("people.signIn.off")}
            </span>
          )}
          {!u.email_verified_at ? (
            <span className="ppl-flag is-warning">
              <MailQuestionMarkIcon aria-hidden="true" />
              {t("security.emailUnverified")}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "active",
      header: t("people.columns.active"),
      sortable: true,
      sortFirst: "descending",
      cell: (u) => (
        <span className="ppl-seen">
          <span className={`ppl-swatch is-${recency(u, now)}`} aria-hidden="true" />
          {u.last_seen_at ? (
            <time dateTime={u.last_seen_at} title={formatDateTime(u.last_seen_at, locale)}>
              {formatRelativeTime(Math.min(Date.parse(u.last_seen_at), now), locale, now)}
            </time>
          ) : (
            <Text tone="subtle">{t("people.neverSignedIn")}</Text>
          )}
        </span>
      ),
    },
    {
      id: "joined",
      header: t("people.columns.joined"),
      numeric: true,
      sortable: true,
      sortFirst: "descending",
      cell: (u) => (
        <time
          className="ppl-nowrap"
          dateTime={u.created_at}
          title={formatDate(u.created_at, locale, { dateStyle: "long" })}
        >
          {new Date(u.created_at).toLocaleDateString(locale, { month: "short", year: "numeric" })}
        </time>
      ),
    },
  ];
}

export type PeopleRowHandlers = {
  actions: ReturnType<typeof useUserActions>;
  run: ReturnType<typeof usePeopleRun>["run"];
  onEdit: (user: User) => void;
  onSetPassword: (user: User) => void;
};

/** A row's menu: access first, then the profile, then sign-in, then taking access away. */
export function PeopleRowActions({
  user,
  isSelf,
  handlers,
}: {
  user: User;
  isSelf: boolean;
  handlers: PeopleRowHandlers;
}) {
  const { t } = useTranslation("users");
  const { actions } = handlers;
  const suspended = user.status === "suspended";
  return (
    <>
      <MenuItem
        icon={KeyRoundIcon}
        render={
          <Link to="/users/$userId" params={{ userId: user.id }} search={{ tab: "access" }} />
        }
      >
        {t("people.actions.changeRole")}
      </MenuItem>
      <MenuSubmenu>
        <MenuSubmenuTrigger icon={UsersRoundIcon}>
          {t("people.actions.addToGroup")}
        </MenuSubmenuTrigger>
        <MenuContent>
          <GroupItems run={handlers.run} ids={[user.id]} />
        </MenuContent>
      </MenuSubmenu>
      <MenuSeparator />
      <MenuItem icon={PencilIcon} onClick={() => handlers.onEdit(user)}>
        {t("rowActions.edit")}
      </MenuItem>
      <MenuItem icon={LockKeyholeIcon} onClick={() => handlers.onSetPassword(user)}>
        {t("table.setPassword")}
      </MenuItem>
      <MenuSeparator />
      {user.mfa_enabled ? (
        <MenuItem icon={ShieldOffIcon} onClick={() => actions.resetMfa(user)}>
          {t("people.actions.resetTwoStep")}
        </MenuItem>
      ) : (
        <MenuItem icon={ShieldCheckIcon} onClick={() => actions.setMfaRequired(user, true)}>
          {t("people.actions.requireTwoStep")}
        </MenuItem>
      )}
      <MenuItem icon={LogOutIcon} onClick={() => actions.revokeSessions(user)}>
        {t("people.actions.signOutEverywhere")}
      </MenuItem>
      <MenuItem
        icon={suspended ? UserCheckIcon : UserXIcon}
        disabled={isSelf}
        onClick={() => (suspended ? actions.reactivate(user) : actions.suspend(user))}
      >
        {suspended ? t("people.actions.reactivate") : t("people.actions.suspend")}
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        icon={TrashIcon}
        tone="danger"
        disabled={isSelf}
        onClick={() => actions.remove(user)}
      >
        {t("table.deleteUser")}
      </MenuItem>
    </>
  );
}
