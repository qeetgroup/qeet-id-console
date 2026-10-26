import { ArrowRightIcon, PlusIcon } from "@qeetrix/icons";
import { Avatar, Button, formatRelativeTime, Heading, Text } from "@qeetrix/react";
import { Alert } from "@qeetrix/react/experimental";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { Me } from "@/platform/auth/session";
import type { ReceivedInvite } from "../api/flows-invitations";
import { EntryAccount, EntryOr } from "./entry-shell";

export type PickerInvitation = Pick<ReceivedInvite, "id" | "tenant_name" | "email" | "expires_at">;

/** What the picker is doing with an invitation: joining it or declining it. */
export type InvitationAction = { id: string; action: "join" | "decline" } | null;

/** "Invited as priya@acme.in · expires in 6 days". */
export function InvitationMeta({ invitation }: { invitation: PickerInvitation }) {
  const { t } = useTranslation("auth-flow");
  return (
    <small>
      {t("organizationSelection.invitedAs", {
        email: invitation.email,
        when: formatRelativeTime(new Date(invitation.expires_at), formatLocale()),
      })}
    </small>
  );
}

/**
 * Invitations waiting for this email, ruled like the organisations beneath them: a row each,
 * with Decline and Join at its end. Joining reloads into that organisation.
 */
export function InvitationList({
  invitations,
  pending,
  disabled,
  onJoin,
  onDecline,
}: {
  invitations: readonly PickerInvitation[];
  pending: InvitationAction;
  disabled?: boolean;
  onJoin: (invitation: PickerInvitation) => void;
  onDecline: (invitation: PickerInvitation) => void;
}) {
  const { t } = useTranslation("auth-flow");
  return (
    <ul className="entry-options" aria-label={t("organizationSelection.invitations")}>
      {invitations.map((invitation) => {
        const busy = pending?.id === invitation.id;
        return (
          <li key={invitation.id} className="entry-invite">
            <Avatar name={invitation.tenant_name} shape="square" size="md" decorative />
            <span className="entry-option-text">
              <strong>{invitation.tenant_name}</strong>
              <InvitationMeta invitation={invitation} />
            </span>
            <span className="entry-invite-actions">
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                loading={busy && pending?.action === "decline"}
                aria-label={t("organizationSelection.declineNamed", {
                  name: invitation.tenant_name,
                })}
                onClick={() => onDecline(invitation)}
              >
                {t("organizationSelection.decline")}
              </Button>
              <Button
                variant="soft"
                size="sm"
                icon={ArrowRightIcon}
                disabled={disabled}
                loading={busy && pending?.action === "join"}
                aria-label={t("organizationSelection.joinNamed", { name: invitation.tenant_name })}
                onClick={() => onJoin(invitation)}
              >
                {t("organizationSelection.join")}
              </Button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * A new account that has been invited, and belongs to nothing yet. Invited once, the page is that
 * invitation: Join it, decline it, or create an organisation instead. Invited more than once, a
 * row each.
 */
export function InvitedView(props: {
  invitations: readonly PickerInvitation[];
  user?: Pick<Me, "email" | "display_name" | "avatar_url">;
  pending: InvitationAction;
  joinError?: string | null;
  disabled: boolean;
  onJoin: (invitation: PickerInvitation) => void;
  onDecline: (invitation: PickerInvitation) => void;
  onCreate: () => void;
  onSignOut: () => void;
}) {
  const { t } = useTranslation("auth-flow");
  const [only] = props.invitations;
  const single = props.invitations.length === 1 && only;
  const { pending } = props;

  return (
    <>
      <div className="entry-heading">
        <Heading level={1} size="display-sm">
          {single
            ? t("organizationSelection.joinTitle", { name: only.tenant_name })
            : t("organizationSelection.invitedTitle")}
        </Heading>
        <Text tone="subtle" size="lg">
          {single
            ? t("organizationSelection.joinLead", { name: only.tenant_name })
            : t("organizationSelection.invitedLead")}
        </Text>
      </div>

      {props.user && (
        <EntryAccount user={props.user} disabled={props.disabled} onSignOut={props.onSignOut} />
      )}

      {single ? (
        <>
          <ul className="entry-options" aria-label={t("organizationSelection.invitations")}>
            <li className="entry-invite" data-single="">
              <Avatar name={only.tenant_name} shape="square" size="md" decorative />
              <span className="entry-option-text">
                <strong>{only.tenant_name}</strong>
                <InvitationMeta invitation={only} />
              </span>
            </li>
          </ul>
          <Button
            size="lg"
            fullWidth
            icon={ArrowRightIcon}
            disabled={props.disabled}
            loading={pending?.action === "join"}
            onClick={() => props.onJoin(only)}
          >
            {pending?.action === "join"
              ? t("organizationSelection.joining", { name: only.tenant_name })
              : t("organizationSelection.joinTitle", { name: only.tenant_name })}
          </Button>
          <div className="entry-links">
            <button
              type="button"
              className="entry-text-button"
              disabled={props.disabled}
              onClick={() => props.onDecline(only)}
            >
              {t("organizationSelection.declineInvitation")}
            </button>
          </div>
        </>
      ) : (
        <InvitationList
          invitations={props.invitations}
          pending={pending}
          disabled={props.disabled}
          onJoin={props.onJoin}
          onDecline={props.onDecline}
        />
      )}

      {props.joinError && (
        <Alert tone="danger" title={t("organizationSelection.joinFailedTitle")} announce="urgent">
          {props.joinError}
        </Alert>
      )}

      <EntryOr />
      <Button
        variant="soft"
        size="lg"
        fullWidth
        icon={PlusIcon}
        disabled={props.disabled}
        onClick={props.onCreate}
      >
        {t("organizationSelection.createInstead")}
      </Button>
    </>
  );
}
