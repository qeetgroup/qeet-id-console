import { buttonVariants, cn } from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  BuildingComplexIcon,
  CirclePlusIcon,
  CreditCardIcon,
  MailIcon,
  NetworkIcon,
  Settings2Icon,
  ShieldCheckIcon,
  UserPlusIcon,
  UserRoundIcon,
  UsersRoundIcon,
} from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import { usePlanName } from "@/modules/billing";

import { type DirectoryData, summarizeConnections, useDirectoryData } from "../api/overview";
import {
  ACTION_CLASS,
  ConnectionMenu,
  DirectoryCard,
  DirectoryFooter,
  DirectoryMetric,
  FOOTER_LINK_CLASS,
  type QueryState,
  TEXT_LINK_CLASS,
} from "./directory-overview-parts";

type QueryName = "users" | "invitations" | "deleted" | "groups" | "organizations" | "scim" | "ldap";

export type DirectoryViewData = Pick<DirectoryData, "tenantId" | "accessState" | "permissions"> & {
  [Name in QueryName]: QueryState & { data?: DirectoryData[Name]["data"] };
};

export function DirectoryOverview() {
  const data = useDirectoryData();
  return <DirectoryOverviewView data={data} />;
}

export function DirectoryOverviewView({ data }: { data: DirectoryViewData }) {
  const { t } = useTranslation("directory");
  const planName = usePlanName();
  const { permissions, users, invitations, deleted, groups, organizations, scim, ldap } = data;
  const currentOrg = organizations.data?.items.find(
    (organization) => organization.id === data.tenantId,
  );
  const connections =
    scim.data && ldap.data && !scim.isError && !ldap.isError
      ? summarizeConnections(scim.data, ldap.data.items)
      : undefined;
  const connectionState = {
    isPending: scim.isPending || ldap.isPending,
    isError: scim.isError || ldap.isError,
    isFetching: scim.isFetching || ldap.isFetching,
    refetch: () => {
      void scim.refetch();
      void ldap.refetch();
    },
  };

  return (
    <div className="@container/directory relative isolate flex min-w-0 flex-col gap-4 before:pointer-events-none before:absolute before:-inset-4 before:-z-10 before:bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] before:bg-size-[32px_32px] before:opacity-10 dark:before:opacity-5">
      <header className="flex flex-col gap-3 pt-1 pb-1">
        <div className="flex flex-col gap-4 @min-[900px]/directory:flex-row @min-[900px]/directory:items-center @min-[900px]/directory:justify-between">
          <h1 className="font-heading text-[32px] leading-10 font-semibold">
            {t("directory.title")}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {permissions.addUser ? (
              <Link
                to="/users"
                search={{ action: "create" }}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), ACTION_CLASS)}
              >
                <UserPlusIcon className="size-4" /> {t("directory.actions.addUser")}
              </Link>
            ) : null}
            {permissions.inviteUsers ? (
              <Link
                to="/invitations"
                search={{ action: "create" }}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), ACTION_CLASS)}
              >
                <MailIcon className="size-4" /> {t("directory.actions.inviteUsers")}
              </Link>
            ) : null}
            {permissions.createGroup ? (
              <Link
                to="/groups"
                search={{ action: "create" }}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), ACTION_CLASS)}
              >
                <UsersRoundIcon className="size-4" /> {t("directory.actions.createGroup")}
              </Link>
            ) : null}
            {permissions.addConnection ? <ConnectionMenu primary /> : null}
          </div>
        </div>
        <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
          {t("directory.description")}
        </p>
      </header>

      {!data.tenantId || data.accessState !== "ready" ? (
        <section className="grid min-h-64 place-items-center border-y border-border/70 px-5 py-10 text-center">
          <div className="max-w-md">
            <ShieldCheckIcon className="mx-auto mb-4 size-8 text-primary" aria-hidden="true" />
            <h2 className="font-heading text-lg font-semibold">
              {t(data.tenantId ? "directory.accessTitle" : "directory.noOrganizationTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(
                data.tenantId
                  ? "directory.accessDescription"
                  : "directory.noOrganizationDescription",
              )}
            </p>
            <Link to="/" className={cn(TEXT_LINK_CLASS, "mt-4")}>
              {t("directory.goToOverview")} <ArrowRightIcon className="size-4" />
            </Link>
          </div>
        </section>
      ) : (
        <section
          aria-label={t("directory.summaryLabel")}
          className="grid gap-4 @min-[720px]/directory:grid-cols-2"
        >
          {permissions.users ? (
            <DirectoryCard
              area="users"
              icon={UserRoundIcon}
              href="/users"
              queries={[users, deleted, ...(permissions.invitations ? [invitations] : [])]}
              footer={
                <>
                  {permissions.addUser ? (
                    <Link to="/users" search={{ action: "create" }} className={FOOTER_LINK_CLASS}>
                      <UserPlusIcon /> {t("directory.actions.addUser")}
                    </Link>
                  ) : null}
                  {permissions.inviteUsers ? (
                    <Link
                      to="/invitations"
                      search={{ action: "create" }}
                      className={FOOTER_LINK_CLASS}
                    >
                      <MailIcon /> {t("directory.actions.inviteUsers")}
                    </Link>
                  ) : null}
                  <Link to="/users" className={FOOTER_LINK_CLASS}>
                    <UsersRoundIcon /> {t("directory.users.manage")}
                  </Link>
                </>
              }
            >
              <DirectoryMetric
                label={t("directory.users.total")}
                value={users.data?.total}
                query={users}
              />
              <DirectoryMetric
                label={t("directory.users.pending")}
                value={invitations.data}
                query={invitations}
                restricted={!permissions.invitations}
                tone="warning"
              />
              <DirectoryMetric
                label={t("directory.users.deleted")}
                value={deleted.data}
                query={deleted}
                tone="deleted"
              />
            </DirectoryCard>
          ) : null}

          <DirectoryCard
            area="organizations"
            icon={BuildingComplexIcon}
            href="/organizations"
            queries={[organizations]}
            footer={
              <>
                <Link to="/organizations" className={FOOTER_LINK_CLASS}>
                  <BuildingComplexIcon /> {t("directory.organizations.manage")}
                </Link>
                {permissions.billing ? (
                  <Link to="/settings/billing" className={FOOTER_LINK_CLASS}>
                    <CreditCardIcon /> {t("directory.actions.billing")}
                  </Link>
                ) : null}
              </>
            }
          >
            <DirectoryMetric
              label={t("directory.organizations.total")}
              value={organizations.data?.items.length}
              query={organizations}
            />
            <DirectoryMetric
              label={t("directory.organizations.plan")}
              value={currentOrg ? planName(currentOrg.plan) : undefined}
              query={organizations}
              badge
            />
            <DirectoryMetric
              label={t("directory.organizations.region")}
              value={currentOrg?.region.toUpperCase()}
              query={organizations}
            />
          </DirectoryCard>

          {permissions.groups ? (
            <DirectoryCard
              area="groups"
              icon={UsersRoundIcon}
              href="/groups"
              queries={[groups]}
              footer={
                <>
                  {permissions.createGroup ? (
                    <Link to="/groups" search={{ action: "create" }} className={FOOTER_LINK_CLASS}>
                      <CirclePlusIcon /> {t("directory.actions.createGroup")}
                    </Link>
                  ) : null}
                  <Link to="/groups" className={FOOTER_LINK_CLASS}>
                    <UsersRoundIcon /> {t("directory.groups.manage")}
                  </Link>
                </>
              }
            >
              <DirectoryMetric
                label={t("directory.groups.total")}
                value={groups.data?.total}
                query={groups}
              />
              <DirectoryMetric
                label={t("directory.groups.topLevel")}
                value={groups.data?.topLevel}
                query={groups}
              />
              <DirectoryMetric
                label={t("directory.groups.nested")}
                value={groups.data?.nested}
                query={groups}
              />
            </DirectoryCard>
          ) : null}

          {permissions.connections ? (
            <DirectoryCard
              area="directories"
              icon={NetworkIcon}
              href="/directory/connections"
              queries={[scim, ldap]}
              footer={
                <>
                  {permissions.addConnection ? <ConnectionMenu /> : null}
                  <Link to="/directory/connections" className={FOOTER_LINK_CLASS}>
                    <Settings2Icon /> {t("directory.directories.manage")}
                  </Link>
                </>
              }
            >
              <DirectoryMetric
                label={t("directory.directories.enabled")}
                value={connections?.enabled}
                query={connectionState}
                tone="success"
              />
              <DirectoryMetric
                label={t("directory.directories.inactive")}
                value={connections?.inactive}
                query={connectionState}
                tone={connections?.inactive ? "warning" : undefined}
              />
              <DirectoryMetric
                label={t("directory.directories.supported")}
                value="SCIM, LDAP / AD"
              />
            </DirectoryCard>
          ) : null}
        </section>
      )}
      <DirectoryFooter />
    </div>
  );
}
