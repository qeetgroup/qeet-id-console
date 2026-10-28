import {
  ArrowLeftRightIcon,
  BuildingComplexIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
} from "@qeetrix/icons";
import {
  Avatar,
  Badge,
  Button,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  Link,
  Skeleton,
} from "@qeetrix/react";
import { Alert, EmptyState, PageContent, PageHeader } from "@qeetrix/react/experimental";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { formatLocale } from "@/i18n";
import { useSubscription } from "@/modules/billing";
import { PageBreadcrumb } from "@/modules/dashboard";
import { useDomains } from "@/modules/organizations/api/domains";
import { orgQueries, useOrgs } from "@/modules/organizations/api/orgs";
import { useOrgLabels } from "@/modules/organizations/components/org-labels";
import {
  changesOf,
  DELETION_GRACE_DAYS,
  isOwner,
  orgRows,
  roleOf,
  twoStepShare,
} from "@/modules/organizations/orgs-model";
import { useOrgActions } from "@/modules/organizations/use-org-actions";
import { TWO_STEP_TARGET, userQueries } from "@/modules/users";
import { useTenantId } from "@/platform/auth/session";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import { IdentitySection } from "./org-identity";
import { HistorySection } from "./org-history";
import { OrgSection } from "./org-section";
import "./org-page.css";

/**
 * An organisation's page: its record, not a second dashboard (the Dashboard covers the one you're
 * in; Users, Security and Billing are their own pages). The header carries its key facts; then
 * Identity, its History (the one you're in), and for an owner, deleting it. Another organisation
 * shows what the list knows and Switch: the server serves nothing more until you're in it.
 */
export function OrgPage({ orgId }: { orgId: string }) {
  const { t } = useTranslation("organizations");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const names = useOrgLabels();
  const access = useCapabilities();
  const tenantId = useTenantId();
  const current = orgId === tenantId;
  const canWrite = access.can("tenant.write");
  const actions = useOrgActions();
  const [switching, setSwitching] = useState(false);

  const listQ = useOrgs();
  const mineQ = useQuery(orgQueries.memberships());
  const recordQ = useQuery({
    ...orgQueries.record(orgId),
    enabled: current && access.can("tenant.read"),
  });
  const historyQ = useQuery({
    ...orgQueries.history(orgId),
    enabled: current && access.can("audit.read"),
  });
  const domainsQ = useDomains(current && access.can("connection.read"));
  const subscriptionQ = useSubscription(current && access.can("billing.read"));

  const org = useMemo(
    () =>
      orgRows(listQ.data?.items ?? [], mineQ.data, tenantId, recordQ.data).find(
        (row) => row.id === orgId,
      ),
    [listQ.data, mineQ.data, tenantId, recordQ.data, orgId],
  );
  const changes = useMemo(() => changesOf(historyQ.data?.items ?? []), [historyQ.data]);
  const actorIds = [
    ...new Set(changes.map((c) => c.actor_user_id).filter((id): id is string => !!id)),
  ];
  const actorsQ = useQueries({
    queries: access.can("user.read")
      ? actorIds.map((id) => ({ ...userQueries.detail(tenantId, id), staleTime: 60_000 }))
      : [],
  });
  const actorNames = new Map(
    actorsQ.flatMap((q, i) => {
      const id = actorIds[i];
      const name = q.data?.display_name?.trim() || q.data?.email;
      return id && name ? [[id, name] as const] : [];
    }),
  );
  const now = listQ.dataUpdatedAt || Date.now();

  if (listQ.isLoading || mineQ.isLoading)
    return (
      <PageContent>
        <Skeleton lines={6} />
      </PageContent>
    );
  if (!org)
    return (
      <PageContent>
        <EmptyState
          icon={BuildingComplexIcon}
          title={t("page.notFound")}
          description={t("page.notFoundDescription")}
          actions={
            <Button render={<RouterLink to="/organizations" />} variant="soft">
              {t("page.backToList")}
            </Button>
          }
        />
      </PageContent>
    );

  const owner = isOwner(org);
  const members = org.member_count ?? 0;
  const share = twoStepShare(org);
  const without = members - (org.mfa_enabled_count ?? 0);
  const created = changes.find((c) => c.action === "tenant.created");
  const createdBy = created?.actor_user_id ? actorNames.get(created.actor_user_id) : undefined;
  const due = org.deletion_due_at;
  const inName = listQ.data?.items.find((item) => item.id === tenantId)?.name;
  const sub = subscriptionQ.data;
  const about = [org.metadata?.industry, org.metadata?.headquarters].filter(
    (v): v is string => typeof v === "string" && !!v.trim(),
  );
  const website = typeof org.metadata?.website === "string" ? org.metadata.website : "";

  const onSwitch = async () => {
    setSwitching(true);
    try {
      const { switchToTenant } = await import("@/modules/authentication");
      await switchToTenant(org.id);
    } catch (err) {
      setSwitching(false);
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={
          // The logo sits in the title, unannounced, until PageHeader has a leading slot (QTRX-48).
          <span className="org-title">
            <Avatar
              name={org.name}
              src={org.logo_url || undefined}
              shape="square"
              size="lg"
              decorative
            />
            {org.name}
          </span>
        }
        status={
          due ? (
            <Badge tone="warning">
              {t("list.row.deleting", { date: formatDate(due, locale, { dateStyle: "medium" }) })}
            </Badge>
          ) : current ? (
            <Badge tone="brand">{t("list.row.current")}</Badge>
          ) : org.status === "suspended" ? (
            <Badge tone="warning">{t("list.row.suspended")}</Badge>
          ) : undefined
        }
        description={
          about.length || website ? (
            <span>
              {about.join(" · ")}
              {website ? (
                <>
                  {about.length ? " · " : null}
                  <Link href={website} target="_blank" rel="noreferrer">
                    {website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </Link>
                </>
              ) : null}
            </span>
          ) : undefined
        }
        actions={
          current ? (
            canWrite ? (
              <Button
                variant="soft"
                tone="neutral"
                icon={PencilIcon}
                render={<RouterLink to="/settings/organization/general" />}
              >
                {t("page.edit")}
              </Button>
            ) : undefined
          ) : org.status === "active" ? (
            <Button icon={ArrowLeftRightIcon} loading={switching} onClick={() => void onSwitch()}>
              {t("page.switchTo", { name: org.name })}
            </Button>
          ) : undefined
        }
        summary={
          <dl className="ppl-band org-page-band">
            <div className="ppl-cell">
              <dt className="ppl-label">{t("page.band.members")}</dt>
              <dd className="ppl-value">{n(members)}</dd>
              <dd className={share < TWO_STEP_TARGET ? "ppl-note is-warning" : "ppl-note"}>
                {org.mfa_enabled_count
                  ? t("page.band.twoStep", { n: n(org.mfa_enabled_count), share })
                  : t("page.band.noTwoStep")}
              </dd>
              {current && without > 0 && access.can("user.read") ? (
                <dd className="ppl-link">
                  <RouterLink to="/users" search={{ twostep: "off" }}>
                    {t("page.band.withoutTwoStep", { n: n(without) })}
                  </RouterLink>
                </dd>
              ) : null}
            </div>
            <div className="ppl-cell">
              <dt className="ppl-label">{t("page.band.role")}</dt>
              <dd className="ppl-value">{roleOf(org) ?? t("list.row.noRole")}</dd>
              <dd className="ppl-note">
                {owner
                  ? current
                    ? t("page.band.canDelete")
                    : t("page.band.canDeleteAfterSwitch")
                  : t("page.band.ownerDeletes")}
              </dd>
            </div>
            <div className="ppl-cell">
              <dt className="ppl-label">{t("page.band.plan")}</dt>
              <dd className="ppl-value">{names.plan(org.plan)}</dd>
              <dd className="ppl-note">
                {org.plan === "free"
                  ? t("page.band.noCharge")
                  : !current
                    ? t("page.band.switchForBilling")
                    : sub && sub.amount_minor > 0 && sub.current_period_end
                      ? t(sub.cancel_at_period_end ? "page.band.endsOn" : "page.band.price", {
                          amount: formatCurrency(sub.amount_minor / 100, sub.currency, locale, {
                            maximumFractionDigits: 0,
                          }),
                          interval: t(
                            `page.band.per.${sub.interval === "year" ? "year" : "month"}`,
                          ),
                          date: formatDate(sub.current_period_end, locale, { dateStyle: "medium" }),
                        })
                      : t("page.band.seeBilling")}
              </dd>
              {current && org.plan !== "free" && access.can("billing.read") ? (
                <dd className="ppl-link">
                  <RouterLink to="/settings/billing">{t("page.band.billing")}</RouterLink>
                </dd>
              ) : null}
            </div>
            {current ? (
              <div className="ppl-cell">
                <dt className="ppl-label">{t("page.band.created")}</dt>
                <dd className="ppl-value">
                  {new Date(org.created_at).toLocaleDateString(locale, {
                    month: "short",
                    year: "numeric",
                  })}
                </dd>
                <dd className="ppl-note">
                  {createdBy
                    ? t("page.band.createdBy", {
                        date: formatDate(org.created_at, locale, { dateStyle: "long" }),
                        name: createdBy,
                      })
                    : formatDate(org.created_at, locale, { dateStyle: "long" })}
                </dd>
              </div>
            ) : (
              <div className="ppl-cell">
                <dt className="ppl-label">{t("page.band.opened")}</dt>
                <dd className="ppl-value">
                  {org.lastUsedAt
                    ? formatDate(org.lastUsedAt, locale, { dateStyle: "medium" })
                    : t("list.opened.never")}
                </dd>
                <dd className="ppl-note">
                  {org.lastUsedAt
                    ? formatDateTime(org.lastUsedAt, locale, { dateStyle: "long" })
                    : t("page.band.neverOpened")}
                </dd>
              </div>
            )}
          </dl>
        }
      />
      <PageContent>
        <div className="org-page">
          {due || !current ? (
            <div className="org-page-notices">
              {due ? (
                <Alert
                  tone="warning"
                  title={t("page.delete.scheduledTitle", {
                    name: org.name,
                    date: formatDate(due, locale, { dateStyle: "long" }),
                  })}
                  actions={
                    owner && canWrite ? (
                      <Button
                        variant="soft"
                        tone="neutral"
                        size="sm"
                        loading={actions.pending}
                        onClick={() => void actions.keep(org)}
                      >
                        {t("page.delete.keep", { name: org.name })}
                      </Button>
                    ) : undefined
                  }
                >
                  {t("page.delete.scheduledDescription", { count: members, n: n(members) })}
                </Alert>
              ) : null}
              {!current ? (
                <Alert
                  tone="info"
                  icon={EyeIcon}
                  title={
                    inName ? t("page.other.title", { name: inName }) : t("page.other.titleNoName")
                  }
                >
                  {t("page.other.description", { name: org.name })}
                </Alert>
              ) : null}
            </div>
          ) : null}

          <IdentitySection
            org={org}
            current={current}
            canEdit={canWrite}
            verifiedAt={domainsQ.data?.items.find((d) => d.domain === org.domain)?.verified_at}
          />

          {current && access.can("audit.read") ? (
            <HistorySection
              changes={changes}
              created={org.created_at}
              now={now}
              names={actorNames}
            />
          ) : null}

          {current && owner && canWrite && !due ? (
            <OrgSection
              id="org-delete"
              title={t("page.delete.heading", { name: org.name })}
              note={t("page.delete.note", {
                count: members,
                n: n(members),
                days: DELETION_GRACE_DAYS,
              })}
              action={
                <Button
                  variant="soft"
                  tone="danger"
                  size="sm"
                  icon={TrashIcon}
                  loading={actions.pending}
                  onClick={() => void actions.remove(org, members)}
                >
                  {t("page.delete.button")}
                </Button>
              }
            />
          ) : null}
        </div>
      </PageContent>
    </>
  );
}
