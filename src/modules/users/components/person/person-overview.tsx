import {
  ActivityIcon,
  KeyRoundIcon,
  LogInIcon,
  LogOutIcon,
  PencilIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserMinusIcon,
  UserRoundIcon,
} from "@qeetrix/icons";
import {
  Badge,
  Button,
  formatDate,
  formatRelativeTime,
  Link,
  type QeetrixIcon,
  Skeleton,
  Text,
} from "@qeetrix/react";
import { CopyButton, Timeline, TimelineItem } from "@qeetrix/react/experimental";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { type ActivityEvent, eventResult, formatEventTitle } from "@/modules/activity";
import { useRemoveMembership } from "@/modules/users/api/person";
import {
  type AccessSummary,
  type SecuritySummary,
  type UserDetail,
  useUserRecentActivity,
} from "@/modules/users/api/user360";
import { userQueries } from "@/modules/users/api/users";
import { activityAt, isWorkKey, personNames, workAttributes } from "@/modules/users/person-model";
import { useUserActions } from "@/modules/users/use-user-actions";
import { useTenantId } from "@/platform/auth/session";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import type { Standing } from "./person-page";
import { AccessSection, Notices, SignInSection, TabLink } from "./person-overview-record";
import { Fact, Facts, Section } from "./person-parts";

/** The icon an event of this kind gets in a timeline. */
export function eventIcon(event: ActivityEvent): QeetrixIcon {
  const type = event.type;
  if (eventResult(event) === "failed" || eventResult(event) === "blocked") return ShieldAlertIcon;
  if (type === "auth.login_succeeded") return LogInIcon;
  if (type.startsWith("auth.mfa") || type.startsWith("mfa.")) return ShieldCheckIcon;
  if (type.includes("logout") || type.includes("session")) return LogOutIcon;
  if (type.startsWith("role.") || type.includes("role")) return KeyRoundIcon;
  if (type.startsWith("user.")) return UserRoundIcon;
  return ActivityIcon;
}

/**
 * Overview: the person's record. What's true of them now (suspended, managed elsewhere, not set
 * up), how they sign in (the ways they have, and what their last sign-ins used), what they can do
 * and why, what they did lately (each event opens in Activity), their details, and deleting them.
 */
export function PersonOverview({
  user,
  standing,
  security,
  access,
  accessLoading,
  signIns,
  signInsLoading,
  canAudit,
  onEdit,
  onDeleted,
}: {
  user: UserDetail;
  standing: Standing;
  security?: SecuritySummary;
  access?: AccessSummary;
  accessLoading: boolean;
  signIns?: ActivityEvent[];
  signInsLoading: boolean;
  canAudit: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  return (
    <div className="prs-page">
      <Notices user={user} standing={standing} security={security} org={access?.organization} />
      <SignInSection
        user={user}
        security={security}
        signIns={signIns}
        loading={signInsLoading}
        canAudit={canAudit}
      />
      <AccessSection user={user} access={access} loading={accessLoading} />
      {canAudit ? <RecentSection user={user} /> : null}
      <DetailsSection
        user={user}
        standing={standing}
        org={access?.organization?.name}
        onEdit={onEdit}
      />
      <LeaveSection
        user={user}
        standing={standing}
        org={access?.organization?.name}
        onDone={onDeleted}
      />
    </div>
  );
}

/** The person's latest events, each opening its record in Activity. */
function RecentSection({ user }: { user: UserDetail }) {
  const { t } = useTranslation("users");
  const locale = formatLocale();
  const recentQ = useUserRecentActivity(user.id, 6);
  const events = recentQ.data?.events ?? [];
  const now = recentQ.dataUpdatedAt || Date.now();
  return (
    <Section
      title={t("person.recent.heading")}
      action={
        <TabLink userId={user.id} tab="activity">
          {t("person.recent.all")}
        </TabLink>
      }
    >
      {recentQ.isLoading ? (
        <Skeleton lines={4} />
      ) : events.length ? (
        <Timeline>
          {events.map((e) => {
            const failed = eventResult(e) === "failed" || eventResult(e) === "blocked";
            return (
              <TimelineItem
                key={e.id}
                icon={eventIcon(e)}
                tone={failed ? "danger" : "neutral"}
                title={
                  <Link render={<RouterLink to="/activity" search={activityAt(e)} />}>
                    {formatEventTitle(e)}
                  </Link>
                }
                description={[e.device || e.browser, e.location, e.ip].filter(Boolean).join(" · ")}
                time={formatRelativeTime(Math.min(Date.parse(e.at), now), locale, now)}
                dateTime={e.at}
              />
            );
          })}
        </Timeline>
      ) : (
        <p className="prs-note">{t("person.recent.none")}</p>
      )}
    </Section>
  );
}

/** Who they are: the profile they and you keep, and what the organisation records about them. */
function DetailsSection({
  user,
  standing,
  org,
  onEdit,
}: {
  user: UserDetail;
  standing: Standing;
  org?: string;
  onEdit: () => void;
}) {
  const { t } = useTranslation("users");
  const locale = formatLocale();
  const tenantId = useTenantId();
  const work = workAttributes(user.metadata);
  const managerEmail = work.find((w) => w.key === "manager_email")?.value;
  const directory = useQuery({ ...userQueries.directory(tenantId), enabled: !!managerEmail });
  const manager = managerEmail
    ? directory.data?.items.find((u) => u.email.toLowerCase() === managerEmail.toLowerCase())
    : undefined;

  return (
    <Section
      title={t("person.details.heading")}
      action={
        standing.canWrite && standing.home ? (
          <Button variant="ghost" size="sm" icon={PencilIcon} onClick={onEdit}>
            {t("person.header.edit")}
          </Button>
        ) : undefined
      }
    >
      <div className="prs-pair">
        <div>
          <p className="prs-pair-cap">{t("person.details.profile")}</p>
          <Facts>
            <Fact label={t("person.details.name")}>
              {user.display_name?.trim() || <Text tone="subtle">{t("person.details.noName")}</Text>}
            </Fact>
            <Fact
              label={t("person.details.email")}
              hint={
                user.email_verified_at
                  ? t("person.details.verifiedOn", {
                      date: formatDate(user.email_verified_at, locale, { dateStyle: "medium" }),
                    })
                  : t("person.details.unverifiedNote")
              }
            >
              {user.email}
              {user.email_verified_at ? (
                <Badge tone="success" size="sm">
                  {t("detail.verified")}
                </Badge>
              ) : (
                <Badge tone="warning" size="sm">
                  {t("person.details.notVerified")}
                </Badge>
              )}
            </Fact>
            <Fact
              label={t("person.details.phone")}
              hint={
                user.phone
                  ? user.phone_verified_at
                    ? t("person.details.verifiedOn", {
                        date: formatDate(user.phone_verified_at, locale, { dateStyle: "medium" }),
                      })
                    : t("person.details.phoneUnverified")
                  : undefined
              }
            >
              {user.phone || <Text tone="subtle">{t("person.signIn.none")}</Text>}
            </Fact>
            <Fact
              label={t("person.details.id")}
              action={<CopyButton value={user.id} label={t("person.details.copyId")} size="sm" />}
            >
              <span className="prs-mono">{user.id}</span>
            </Fact>
            {standing.home ? null : (
              <Fact label={t("person.details.managedBy")}>
                <span className="prs-mono">{user.tenant_id}</span>
              </Fact>
            )}
            <Fact label={t("person.details.updated")}>
              {formatDate(user.updated_at, locale, { dateStyle: "medium" })}
            </Fact>
          </Facts>
        </div>
        <div>
          <p className="prs-pair-cap">{t("person.details.work")}</p>
          {work.length ? (
            <Facts>
              {work.map((w) => (
                <Fact
                  key={w.key}
                  label={isWorkKey(w.key) ? t(`person.work.${w.key}`) : w.key}
                  hint={w.key === "manager_email" && manager ? w.value : undefined}
                >
                  {w.key === "manager_email" && manager ? (
                    <Link
                      render={<RouterLink to="/users/$userId" params={{ userId: manager.id }} />}
                    >
                      {manager.display_name?.trim() || manager.email}
                    </Link>
                  ) : w.key === "employee_id" ? (
                    <span className="prs-mono">{w.value}</span>
                  ) : (
                    w.value
                  )}
                </Fact>
              ))}
            </Facts>
          ) : (
            <p className="prs-note">
              {standing.home
                ? t("person.details.noWork", { org: org ?? t("person.thisOrg") })
                : t("person.details.workElsewhere")}
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}

/** Deleting the person (their account is here) or removing them (another organisation's). */
function LeaveSection({
  user,
  standing,
  org,
  onDone,
}: {
  user: UserDetail;
  standing: Standing;
  org?: string;
  onDone: () => void;
}) {
  const { t } = useTranslation("users");
  const actions = useUserActions();
  const runSensitive = useSensitiveAction();
  const removeM = useRemoveMembership();
  const { full, first } = personNames(user);
  const here = org ?? t("person.thisOrg");

  if (standing.manage)
    return (
      <Section
        title={t("person.leave.deleteHeading", { name: full })}
        note={t("person.leave.deleteNote", { name: first })}
        action={
          <Button
            variant="soft"
            tone="danger"
            size="sm"
            icon={TrashIcon}
            loading={actions.pendingAction.remove}
            onClick={() => void actions.remove(user, onDone)}
          >
            {t("person.leave.delete")}
          </Button>
        }
      />
    );
  if (standing.canWrite && !standing.home && !standing.self)
    return (
      <Section
        title={t("person.leave.removeHeading", { name: full, org: here })}
        note={t("person.leave.removeNote", { name: first, org: here })}
        action={
          <Button
            variant="soft"
            tone="danger"
            size="sm"
            icon={UserMinusIcon}
            loading={removeM.isPending}
            onClick={() =>
              void runSensitive({
                confirm: {
                  title: t("person.confirm.remove.title", { name: full, org: here }),
                  description: t("person.confirm.remove.description", { org: here }),
                  confirmLabel: t("person.confirm.remove.button"),
                  tone: "destructive",
                },
                actionLabel: t("person.confirm.remove.button"),
                run: () => removeM.mutateAsync(user.id),
              })
                .then(onDone)
                .catch(settleSensitiveAction)
            }
          >
            {t("person.leave.remove", { org: here })}
          </Button>
        }
      />
    );
  return null;
}
