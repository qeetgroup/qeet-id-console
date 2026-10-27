import { CopyIcon, SendIcon, TrashIcon, UserRoundIcon } from "@qeetrix/icons";
import {
  Badge,
  type BadgeTone,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  MenuItem,
  MenuSeparator,
  type TableColumn,
  Text,
} from "@qeetrix/react";
import { AvatarItem } from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { formatLocale } from "@/i18n";
import type { Invitation } from "@/modules/users/api/invitations";
import type { User } from "@/modules/users/api/users";
import {
  canInviteAgain,
  canResend,
  canRevoke,
  daysLeft,
  joinDays,
} from "@/modules/users/invitations-model";
import { DAY_MS, personName } from "@/modules/users/people-model";
import { roleLabel } from "@/modules/users/components/people/people-table";

const STATUS_TONE: Record<Invitation["status"], BadgeTone> = {
  pending: "info",
  accepted: "success",
  expired: "warning",
  revoked: "neutral",
  declined: "neutral",
};

/** The columns: who was invited, the role they'll get, where it stands, when it went, and how it ended. */
export function useInvitationColumns({
  now,
  roleName,
  member,
  showRole,
}: {
  now: number;
  roleName: (id: string) => string | undefined;
  member: (email: string) => User | undefined;
  showRole: boolean;
}): TableColumn<Invitation>[] {
  const { t } = useTranslation("users");
  const locale = formatLocale();
  // Recent sends read as "3 days ago"; older ones as their date.
  const when = (at: string) => {
    const ms = Date.parse(at);
    return (
      <time dateTime={at} title={formatDateTime(at, locale)} className="ppl-nowrap">
        {now - ms < 30 * DAY_MS
          ? formatRelativeTime(Math.min(ms, now), locale, now)
          : formatDate(at, locale)}
      </time>
    );
  };
  const outcome = (i: Invitation) => {
    if (i.status === "pending") {
      const left = daysLeft(i, now);
      return (
        <span className={left <= 3 ? "sub-warn ppl-nowrap" : "ppl-nowrap"}>
          {left <= 1
            ? t("invites.outcome.expiresToday")
            : t("invites.outcome.expiresIn", { n: left })}
        </span>
      );
    }
    if (i.status === "accepted") {
      const d = Math.round(joinDays(i) ?? 0);
      return (
        <Text tone="subtle">
          {d < 1
            ? t("invites.outcome.joinedSameDay")
            : t("invites.outcome.joinedAfter", { count: d })}
        </Text>
      );
    }
    if (i.status === "expired")
      return (
        <Text tone="subtle">
          {t("invites.outcome.expired")} {when(i.expires_at)}
        </Text>
      );
    return <Text tone="subtle">—</Text>;
  };
  return [
    {
      id: "who",
      header: t("invites.columns.invited"),
      primary: true,
      sortable: true,
      cell: (i) => {
        const person = i.status === "accepted" ? member(i.email) : undefined;
        return person ? (
          <AvatarItem
            name={personName(person)}
            description={i.email}
            src={person.avatar_url ?? undefined}
          />
        ) : (
          <AvatarItem name={i.email} />
        );
      },
    },
    ...(showRole
      ? [
          {
            id: "role",
            header: t("people.columns.role"),
            sortable: true,
            cell: (i: Invitation) => {
              const name = i.role_id ? roleName(i.role_id) : undefined;
              return name ? roleLabel(t, name) : <Text tone="subtle">{t("people.noRole")}</Text>;
            },
          } satisfies TableColumn<Invitation>,
        ]
      : []),
    {
      id: "status",
      header: t("invites.columns.status"),
      cell: (i) => (
        <Badge tone={STATUS_TONE[i.status]} size="sm">
          {t(`invites.status.${i.status}`)}
        </Badge>
      ),
    },
    {
      id: "sent",
      header: t("invites.columns.sent"),
      sortable: true,
      sortFirst: "descending",
      cell: (i) => when(i.created_at),
    },
    { id: "outcome", header: t("invites.columns.outcome"), cell: outcome },
  ];
}

/** A row's menu: what this invitation allows, by its status. */
export function InvitationRowActions({
  invite,
  member,
  onResend,
  onRevoke,
  onInviteAgain,
}: {
  invite: Invitation;
  member?: User;
  onResend: (invite: Invitation) => void;
  onRevoke: (invite: Invitation) => void;
  onInviteAgain: (invite: Invitation) => void;
}) {
  const { t } = useTranslation("users");
  const copy = (
    <MenuItem
      icon={CopyIcon}
      onClick={() => {
        void navigator.clipboard.writeText(invite.email);
        toast.success(t("invites.actions.copied"));
      }}
    >
      {t("invites.actions.copyEmail")}
    </MenuItem>
  );
  if (invite.status === "accepted")
    return member ? (
      <MenuItem
        icon={UserRoundIcon}
        render={<Link to="/users/$userId" params={{ userId: member.id }} />}
      >
        {t("invites.actions.openProfile")}
      </MenuItem>
    ) : (
      <MenuItem icon={UserRoundIcon} disabled>
        {t("invites.actions.noLongerMember")}
      </MenuItem>
    );
  return (
    <>
      {canResend(invite) ? (
        <MenuItem icon={SendIcon} onClick={() => onResend(invite)}>
          {invite.status === "expired"
            ? t("invites.actions.sendAgain")
            : t("invites.actions.resend")}
        </MenuItem>
      ) : null}
      {canInviteAgain(invite) ? (
        <MenuItem icon={SendIcon} onClick={() => onInviteAgain(invite)}>
          {t("invites.actions.inviteAgain")}
        </MenuItem>
      ) : null}
      {copy}
      {canRevoke(invite) ? (
        <>
          <MenuSeparator />
          <MenuItem icon={TrashIcon} tone="danger" onClick={() => onRevoke(invite)}>
            {t("invites.actions.revoke")}
          </MenuItem>
        </>
      ) : null}
    </>
  );
}
