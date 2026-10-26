import { ChevronRightIcon, PlusIcon, RefreshCwIcon, SearchIcon } from "@qeetrix/icons";
import { Avatar, Badge, Button, Heading, Skeleton, Spinner, Text, TextField } from "@qeetrix/react";
import { Alert } from "@qeetrix/react/experimental";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { EligibleOrganization } from "@/platform/auth/organization-selection";
import {
  type Me,
  useIdleLogout,
  useLogout,
  useMe,
  useTenantId,
  useUserId,
} from "@/platform/auth/session";
import { errorMessage } from "@/platform/errors/user-message";
import { isOneOf } from "@/shared/utils/one-of";
import { switchToTenant } from "../api/flows";
import {
  useAcceptInvitation,
  useDeclineInvitation,
  useMyInvitations,
} from "../api/flows-invitations";
import { useEligibleOrganizations } from "../api/organization-selection";
import {
  filterOrganizations,
  mostRecentOrganization,
  organizationImage,
} from "../organization-selection-model";
import { EntryAccount } from "./entry-shell";
import {
  type InvitationAction,
  InvitationList,
  InvitedView,
  type PickerInvitation,
} from "./invitation-list";

// The roles and plans with their own copy; any other shows as the server names it.
const KNOWN_ROLES = ["owner", "admin", "member"] as const;
const KNOWN_PLANS = ["free", "starter", "pro", "enterprise"] as const;
// A short list shows whole. Past this many, the most recently used show first, with search and
// a way to see them all.
const SHORT_LIST = 5;

export type OrganizationSelectorViewProps = {
  organizations: EligibleOrganization[];
  user?: Pick<Me, "id" | "email" | "display_name" | "avatar_url">;
  loading: boolean;
  error: boolean;
  fetching: boolean;
  signingOut?: boolean;
  entryError?: string | null;
  /** Invitations waiting for this email; each can be joined or declined here. */
  invitations?: readonly PickerInvitation[];
  invitationAction?: InvitationAction;
  joinError?: string | null;
  onJoin?: (invitation: PickerInvitation) => void;
  onDecline?: (invitation: PickerInvitation) => void;
  onRetry: () => unknown;
  onContinue: (organizationId: string) => Promise<unknown>;
  onCreate: () => void;
  onAccount: () => void;
  onSignOut: () => void;
};

export function OrganizationSelectionPage({ onCreate }: { onCreate: () => void }) {
  const userId = useUserId();
  const tenantId = useTenantId();
  const organizations = useEligibleOrganizations(userId);
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const [entryError, setEntryError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const automaticAttempt = useRef(-1);
  useIdleLogout(10 * 60 * 1000);
  // Invitations come before going on: someone invited joins their team rather than being taken
  // into an organisation, or on to create one. If they can't be read, nothing waits for them.
  const invitationsQ = useMyInvitations();
  const invitations = invitationsQ.data?.items ?? [];
  const invitationsKnown = !invitationsQ.isPending;
  const accept = useAcceptInvitation();
  const decline = useDeclineInvitation();
  const [invitationAction, setInvitationAction] = useState<InvitationAction>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (
      !organizations.isSuccess ||
      !invitationsKnown ||
      invitations.length > 0 ||
      organizations.data.length > 1 ||
      automaticAttempt.current === retry
    )
      return;
    automaticAttempt.current = retry;
    // One organisation opens; none goes on to create the first.
    const only = organizations.data[0];
    const enter = !only
      ? navigate({ to: "/create-organization", replace: true })
      : only.id !== tenantId
        ? switchToTenant(only.id)
        : navigate({ to: "/", replace: true });
    void Promise.resolve(enter).catch((failure) => setEntryError(errorMessage(failure)));
  }, [
    organizations.data,
    organizations.isSuccess,
    invitationsKnown,
    invitations.length,
    tenantId,
    navigate,
    retry,
  ]);

  return (
    <OrganizationSelectorView
      organizations={organizations.isError ? [] : (organizations.data ?? [])}
      user={me.isError ? undefined : me.data}
      loading={
        organizations.isPending ||
        !invitationsKnown ||
        (organizations.isSuccess &&
          organizations.data.length < 2 &&
          invitations.length === 0 &&
          !entryError)
      }
      error={organizations.isError}
      entryError={entryError}
      invitations={invitations}
      invitationAction={invitationAction}
      joinError={joinError}
      onJoin={(invitation) => {
        setJoinError(null);
        setInvitationAction({ id: invitation.id, action: "join" });
        // Success reloads into the organisation, so the action stays on until then.
        accept.mutate(invitation.id, {
          onError: (failure) => {
            setInvitationAction(null);
            setJoinError(errorMessage(failure));
          },
        });
      }}
      onDecline={(invitation) => {
        setJoinError(null);
        setInvitationAction({ id: invitation.id, action: "decline" });
        decline.mutate(invitation.id, { onSettled: () => setInvitationAction(null) });
      }}
      fetching={organizations.isFetching}
      signingOut={logout.isPending}
      onRetry={async () => {
        const result = await organizations.refetch();
        if (result.isSuccess) {
          setEntryError(null);
          setRetry((value) => value + 1);
        }
      }}
      onContinue={async (id) => {
        if (!organizations.data?.some((organization) => organization.id === id))
          throw new Error("Organization is no longer available");
        await switchToTenant(id);
      }}
      onCreate={onCreate}
      onAccount={() => void navigate({ to: "/account/profile" })}
      onSignOut={() => logout.mutate()}
    />
  );
}

/**
 * Choosing an organisation, in the entry frame: one ruled list, most recently used first, where
 * a click opens that organisation's console. Search appears once the list is long.
 */
export function OrganizationSelectorView(props: OrganizationSelectorViewProps) {
  const { t, i18n } = useTranslation("auth-flow");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const organizations = props.error ? [] : props.organizations;
  const recent = mostRecentOrganization(organizations);
  const long = organizations.length > SHORT_LIST;
  const searching = long && search.trim() !== "";
  // A long list starts with the most recently used; all of them, A to Z, on request.
  const collapsed = long && !searching && !showAll;
  const matches = filterOrganizations(
    organizations,
    searching ? search : "",
    "",
    long && showAll && !searching ? "name" : "recent",
    i18n.language,
  );
  const visible = collapsed ? matches.slice(0, SHORT_LIST) : matches;
  const disabled = opening !== null || !!props.signingOut || !!props.invitationAction;
  const invitations = props.invitations ?? [];

  const roleLabel = (name: string) => {
    const role = name.toLowerCase();
    return isOneOf(KNOWN_ROLES, role) ? t(`organizationSelection.roles.${role}`) : name;
  };
  const planLabel = (code: string) => {
    const plan = code.replace(/_year$/, "");
    return isOneOf(KNOWN_PLANS, plan)
      ? t(`organizationSelection.plans.${plan}`)
      : code || t("organizationSelection.notReported");
  };

  async function open(organization: EligibleOrganization) {
    if (busy.current || props.loading || props.error || props.signingOut) return;
    busy.current = true;
    setOpening(organization.id);
    setError(null);
    try {
      await props.onContinue(organization.id);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      busy.current = false;
      setOpening(null);
    }
  }

  const retry = (
    <Button
      variant="soft"
      size="sm"
      icon={RefreshCwIcon}
      disabled={props.fetching || disabled}
      onClick={() => void props.onRetry()}
    >
      {t("organizationSelection.retry")}
    </Button>
  );

  // Invited, with no organisation yet: the invitations are the page, creating one the alternative.
  if (!props.loading && !props.error && organizations.length === 0 && invitations.length > 0) {
    return (
      <InvitedView
        invitations={invitations}
        user={props.user}
        pending={props.invitationAction ?? null}
        joinError={props.joinError}
        disabled={disabled}
        onJoin={(invitation) => props.onJoin?.(invitation)}
        onDecline={(invitation) => props.onDecline?.(invitation)}
        onCreate={props.onCreate}
        onSignOut={props.onSignOut}
      />
    );
  }

  const joinFailed = props.joinError && (
    <Alert tone="danger" title={t("organizationSelection.joinFailedTitle")} announce="urgent">
      {props.joinError}
    </Alert>
  );

  return (
    <>
      <div className="entry-heading">
        <Heading level={1} size="display-sm">
          {t("organizationSelection.title")}
        </Heading>
        <Text tone="subtle" size="lg">
          {props.loading
            ? t("organizationSelection.loading")
            : t("organizationSelection.description", { count: organizations.length })}
        </Text>
      </div>

      {props.user && (
        <EntryAccount user={props.user} disabled={disabled} onSignOut={props.onSignOut} />
      )}

      {props.loading ? (
        <div role="status" aria-label={t("organizationSelection.loading")} className="entry-form">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      ) : props.error ? (
        <Alert
          tone="danger"
          title={t("organizationSelection.loadError")}
          announce="urgent"
          actions={retry}
        >
          {t("organizationSelection.loadErrorText")}
        </Alert>
      ) : (
        <>
          {invitations.length > 0 && (
            <>
              <Text size="sm" tone="subtle">
                {t("organizationSelection.invitations")}
              </Text>
              <InvitationList
                invitations={invitations}
                pending={props.invitationAction ?? null}
                disabled={disabled}
                onJoin={(invitation) => props.onJoin?.(invitation)}
                onDecline={(invitation) => props.onDecline?.(invitation)}
              />
              {joinFailed}
              <Text size="sm" tone="subtle">
                {t("organizationSelection.available")}
              </Text>
            </>
          )}
          {long && (
            <TextField
              type="search"
              label={t("organizationSelection.search")}
              hideLabel
              name="search"
              icon={SearchIcon}
              placeholder={t("organizationSelection.searchPlaceholder")}
              value={search}
              disabled={disabled}
              onChange={(event) => {
                setSearch(event.target.value);
                setError(null);
              }}
            />
          )}
          {long && !searching && (
            <Text size="sm" tone="subtle">
              {collapsed
                ? t("organizationSelection.recentLabel")
                : t("organizationSelection.allLabel")}
            </Text>
          )}
          {visible.length === 0 ? (
            <div className="entry-links">
              <span>{t("organizationSelection.noMatches")}</span>
              <button type="button" className="entry-text-button" onClick={() => setSearch("")}>
                {t("organizationSelection.clearSearch")}
              </button>
            </div>
          ) : (
            <ul
              className="entry-options"
              aria-label={t("organizationSelection.available")}
              data-scroll={long && !collapsed ? "" : undefined}
            >
              {visible.map((organization) => {
                const isOpening = opening === organization.id;
                return (
                  <li key={organization.id}>
                    <button
                      type="button"
                      className="entry-option"
                      data-kind="organisation"
                      data-opening={isOpening ? "" : undefined}
                      disabled={disabled}
                      aria-busy={isOpening || undefined}
                      onClick={() => void open(organization)}
                    >
                      <Avatar
                        name={organization.name}
                        src={organizationImage(organization.logo_url)}
                        shape="square"
                        size="md"
                        decorative
                      />
                      <span className="entry-option-text">
                        <strong>{organization.name}</strong>
                        <small>
                          {[organization.domain || organization.slug, planLabel(organization.plan)]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      </span>
                      <span className="entry-option-tags">
                        {recent === organization.id && (
                          <Badge tone="brand">{t("organizationSelection.lastUsed")}</Badge>
                        )}
                        {organization.roles.map((role) => (
                          <Badge key={role} tone="neutral">
                            {roleLabel(role)}
                          </Badge>
                        ))}
                      </span>
                      {isOpening ? (
                        <Spinner
                          size="sm"
                          label={t("organizationSelection.opening", { name: organization.name })}
                        />
                      ) : (
                        <ChevronRightIcon shape="sharp" size={16} aria-hidden="true" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {searching && (
            <Text size="sm" tone="subtle" role="status">
              {t("organizationSelection.results", {
                count: visible.length,
                total: organizations.length,
              })}
            </Text>
          )}
          {long && !searching && (
            <div className="entry-links">
              <button
                type="button"
                className="entry-text-button"
                disabled={disabled}
                onClick={() => setShowAll(!showAll)}
              >
                {showAll
                  ? t("organizationSelection.showRecent")
                  : t("organizationSelection.showAll", { count: organizations.length })}
              </button>
            </div>
          )}
        </>
      )}

      {(error || props.entryError) && (
        <Alert
          tone="danger"
          title={t("organizationSelection.entryFailedTitle")}
          announce="urgent"
          actions={props.entryError ? retry : undefined}
        >
          {error || props.entryError}
        </Alert>
      )}

      <Button
        variant="soft"
        size="lg"
        fullWidth
        icon={PlusIcon}
        disabled={disabled}
        onClick={props.onCreate}
      >
        {t("organizationSelection.create")}
      </Button>
      <div className="entry-links">
        <button
          type="button"
          className="entry-text-button"
          disabled={disabled}
          onClick={props.onAccount}
        >
          {t("organizationSelection.accountSettings")}
        </button>
      </div>
    </>
  );
}
