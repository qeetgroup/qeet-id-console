// The record panels of the person's Overview: what's true of them now, how they sign in, and what
// they can do and why. person-overview.tsx composes them.

import { ShieldCheckIcon } from "@qeetrix/icons";
import { Button, formatDate, formatNumber, formatRelativeTime, Skeleton } from "@qeetrix/react";
import { Alert } from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { ActivityEvent } from "@/modules/activity";
import { SplitBar } from "@/modules/dashboard";
import { SIGN_IN_SAMPLE, useSuspension } from "@/modules/users/api/person";
import {
  type AccessSummary,
  type SecuritySummary,
  type UserDetail,
  useUserSocialIdentities,
} from "@/modules/users/api/user360";
import { roleLabel } from "@/modules/users/components/people/people-table";
import { personNames, providerName, type SignInMix, signInMix } from "@/modules/users/person-model";
import type { User360Tab } from "@/modules/users/tabs";
import { useUserActions } from "@/modules/users/use-user-actions";
import type { Standing } from "./person-page";
import { Panel, Panels, Section } from "./person-parts";

/**
 * A view of the person's page, as a link: what the section heads open. A Button rendered as a link
 * is still announced as a button until QTRX-8.
 */
export function TabLink({
  userId,
  tab,
  children,
}: {
  userId: string;
  tab: User360Tab;
  children: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      render={<RouterLink to="/users/$userId" params={{ userId }} search={{ tab }} />}
    >
      {children}
    </Button>
  );
}

/** What's true of the person now, with the fix where there is one. */
export function Notices({
  user,
  standing,
  security,
  org,
}: {
  user: UserDetail;
  standing: Standing;
  security?: SecuritySummary;
  org?: { name: string } | null;
}) {
  const { t } = useTranslation("users");
  const locale = formatLocale();
  const actions = useUserActions();
  const { first } = personNames(user);
  const suspended = user.status === "suspended";
  const suspension = useSuspension(user.id, suspended).data;

  const emailGap = !user.email_verified_at;
  // A passkey is a second step by itself, but a password alone still opens the account.
  const stepGap = !!security && security.password_set && !security.mfa_enabled;
  const setupGap =
    standing.home && !suspended && user.status !== "invited" && (emailGap || stepGap);
  if (standing.home && !suspended && !setupGap) return null;

  return (
    <div className="prs-notices">
      {!standing.home ? (
        <Alert tone="info" title={t("person.notice.elsewhereTitle", { name: first })}>
          {t("person.notice.elsewhere", { name: first, org: org?.name ?? t("person.thisOrg") })}
        </Alert>
      ) : null}
      {suspended ? (
        <Alert
          tone="warning"
          title={
            suspension?.suspended_at
              ? t("person.notice.suspendedWhen", {
                  when: formatRelativeTime(Date.parse(suspension.suspended_at), locale),
                  reason: t(`people.suspended.reasons.${reasonKey(suspension.reason)}`),
                })
              : t("person.notice.suspendedTitle")
          }
        >
          {[
            suspension?.suspended_at
              ? t("person.notice.suspendedBy", {
                  source: t(`people.suspended.sources.${sourceKey(suspension.source)}`),
                  date: formatDate(suspension.suspended_at, locale, { dateStyle: "long" }),
                })
              : null,
            t("person.notice.suspended", { name: first }),
          ]
            .filter(Boolean)
            .join(" ")}
        </Alert>
      ) : null}
      {setupGap ? (
        <Alert
          tone="warning"
          title={
            emailGap
              ? t("person.notice.setupTitle", { name: first })
              : t("person.notice.noStepTitle", { name: first })
          }
          actions={
            stepGap && standing.manage && !security?.mfa_required ? (
              <Button
                size="sm"
                variant="soft"
                icon={ShieldCheckIcon}
                loading={actions.pendingAction.mfaRequired}
                onClick={() => void actions.setMfaRequired(user, true)}
              >
                {t("person.notice.requireStep")}
              </Button>
            ) : undefined
          }
        >
          {[
            emailGap ? t("person.notice.emailGap") : null,
            stepGap ? t("person.notice.stepGap", { name: first }) : null,
            stepGap && standing.manage && !security?.mfa_required
              ? t("person.notice.stepFix", { name: first })
              : null,
          ]
            .filter(Boolean)
            .join(" ")}
        </Alert>
      ) : null}
    </div>
  );
}

const REASONS = [
  "unspecified",
  "provider",
  "suspicious_activity",
  "policy_violation",
  "account_compromise",
  "offboarding",
  "inactive",
  "other",
] as const;
const reasonKey = (reason: string) =>
  (REASONS as readonly string[]).includes(reason)
    ? (reason as (typeof REASONS)[number])
    : "unspecified";
const sourceKey = (source: string) =>
  source === "policy" || source === "provider" ? source : "manual";

/** How the person signs in: the ways they have, and what their last sign-ins used. */
export function SignInSection({
  user,
  security,
  signIns,
  loading,
  canAudit,
}: {
  user: UserDetail;
  security?: SecuritySummary;
  signIns?: ActivityEvent[];
  loading: boolean;
  canAudit: boolean;
}) {
  const { t } = useTranslation("users");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const { first } = personNames(user);
  const identities = useUserSocialIdentities(user.id).data?.items ?? [];
  const providers = [...new Set(identities.map((i) => providerName(i.provider)))];

  return (
    <Section
      title={t("person.signIn.heading", { name: first })}
      note={t("person.signIn.note", { name: first })}
      action={
        <TabLink userId={user.id} tab="security">
          {t("person.tabs.security")}
        </TabLink>
      }
    >
      {!security ? (
        <Skeleton lines={3} />
      ) : (
        <Panels>
          <Panel
            cap={t("person.signIn.password")}
            value={security.password_set ? t("person.signIn.set") : t("person.signIn.none")}
            tone={security.password_set ? undefined : "none"}
            note={
              security.password_set
                ? security.password_changed_at
                  ? t("person.signIn.passwordSince", {
                      date: formatDate(security.password_changed_at, locale, {
                        dateStyle: "medium",
                      }),
                    })
                  : t("person.signIn.passwordSet")
                : t("person.signIn.noPassword", { name: first })
            }
          />
          <Panel
            cap={t("person.signIn.twoStep")}
            value={security.mfa_enabled ? t("person.band.on") : t("person.band.off")}
            // Off is a warning only while a password alone opens the account; someone who signs in
            // with single sign-on meets their provider's own checks.
            tone={security.mfa_enabled ? undefined : security.password_set ? "warning" : "none"}
            note={
              security.mfa_enabled
                ? [
                    security.totp_enabled ? t("person.band.factors.app") : null,
                    security.otp_factors ? t("person.band.factors.codes") : null,
                    security.push_devices ? t("person.band.factors.phone") : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : security.password_set
                  ? t("person.signIn.passwordAlone", { name: first })
                  : t("person.band.noSecondStep")
            }
            noteTone={!security.mfa_enabled && security.password_set ? "warning" : undefined}
            meta={security.mfa_required ? t("person.signIn.alwaysAsked") : undefined}
          />
          <Panel
            cap={t("person.signIn.passkeys")}
            value={security.passkeys ? n(security.passkeys) : t("person.signIn.none")}
            tone={security.passkeys ? undefined : "none"}
            note={
              security.passkeys
                ? security.passkey_last_used_at
                  ? t("person.signIn.passkeyUsed", {
                      when: formatRelativeTime(Date.parse(security.passkey_last_used_at), locale),
                    })
                  : t("person.signIn.passkeyUnused")
                : t("person.signIn.passkeyWhat")
            }
          />
          <Panel
            cap={t("person.signIn.connected")}
            value={identities.length ? n(identities.length) : t("person.signIn.none")}
            tone={identities.length ? undefined : "none"}
            note={providers.length ? providers.join(", ") : t("person.signIn.connectedWhat")}
          />
        </Panels>
      )}
      {canAudit ? (
        loading ? (
          <Skeleton lines={3} />
        ) : (
          <Methods
            mix={signInMix(signIns ?? [])}
            first={first}
            capped={(signIns?.length ?? 0) >= SIGN_IN_SAMPLE}
          />
        )
      ) : null}
    </Section>
  );
}

/** The person's last sign-ins by method: one bar each, on one scale, the count beside it. */
function Methods({ mix, first, capped }: { mix: SignInMix; first: string; capped: boolean }) {
  const { t } = useTranslation("users");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  if (!mix.total)
    return <p className="prs-note">{t("person.signIn.noSignIns", { name: first })}</p>;
  const most = mix.methods[0]?.count ?? 1;
  const without = mix.total - mix.secondStep;
  return (
    <div className="prs-panels">
      <div className="prs-panel">
        <p className="prs-cap">
          {!capped
            ? t("person.signIn.allSignIns", { count: mix.total, n: n(mix.total) })
            : t("person.signIn.lastSignIns", { n: n(mix.total) })}
        </p>
        <ul className="prs-methods">
          {mix.methods.map((m) => (
            <li key={m.method} className="prs-method">
              <span className="prs-method-name">{t(`person.methods.${m.method}`)}</span>
              <span className="prs-method-track" aria-hidden="true">
                <span
                  className="prs-method-bar"
                  style={{ inlineSize: `${(m.count / most) * 100}%` }}
                />
              </span>
              <span className="prs-method-count">{n(m.count)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="prs-panel">
        <p className="prs-cap">{t("person.signIn.secondStepCap")}</p>
        <p className="prs-value">
          {t("person.signIn.secondStepShare", { n: n(mix.secondStep), total: n(mix.total) })}
        </p>
        <SplitBar
          label={t("person.signIn.secondStepLabel", {
            n: n(mix.secondStep),
            total: n(mix.total),
          })}
          parts={[
            { value: mix.secondStep, color: "var(--qx-color-dataviz-categorical-1)" },
            { value: without, color: "var(--qx-color-border-strong)" },
          ]}
        />
        <p className="prs-panel-note">
          {[
            without
              ? t("person.signIn.withoutStep", { count: without, n: n(without) })
              : t("person.signIn.everyStep"),
            // The server counts a single sign-on sign-in as no second step here (secondFactorOfMethod):
            // the identity provider asks for its own.
            without && mix.methods.some((m) => m.method === "sso")
              ? t("person.signIn.ssoOwn")
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </div>
  );
}

/** What the person can do, and why: roles given directly, their groups, what that adds up to. */
export function AccessSection({
  user,
  access,
  loading,
}: {
  user: UserDetail;
  access?: AccessSummary;
  loading: boolean;
}) {
  const { t } = useTranslation("users");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const { first } = personNames(user);
  const roles = access?.roles ?? [];
  const groups = access?.groups ?? [];
  const shown = groups.slice(0, 3).map((g) => g.name);
  return (
    <Section
      title={t("person.can.heading", { name: first })}
      note={t("person.can.note", { name: first })}
      action={
        <TabLink userId={user.id} tab="access">
          {t("person.tabs.access")}
        </TabLink>
      }
    >
      {loading || !access ? (
        <Skeleton lines={3} />
      ) : (
        <Panels>
          <Panel
            cap={t("person.can.roles")}
            value={
              roles.length
                ? roles.map((r) => roleLabel(t, r.name)).join(", ")
                : t("person.signIn.none")
            }
            tone={roles.length ? undefined : "none"}
            note={
              roles.length === 1 && roles[0]?.description
                ? roles[0].description
                : roles.length
                  ? t("person.can.rolesGiven", { count: roles.length, n: n(roles.length) })
                  : t("person.can.noRole", { name: first })
            }
          />
          <Panel
            cap={t("person.can.groups")}
            value={groups.length ? n(groups.length) : t("person.signIn.none")}
            tone={groups.length ? undefined : "none"}
            note={
              groups.length
                ? [
                    shown.join(", "),
                    groups.length > 3 ? t("person.can.more", { n: n(groups.length - 3) }) : null,
                  ]
                    .filter(Boolean)
                    .join(" ")
                : t("person.can.noGroups")
            }
          />
          <Panel
            cap={t("person.can.permissions")}
            value={n(access.permissions_total)}
            tone={access.permissions_total ? undefined : "none"}
            note={t("person.can.split", {
              direct: n(access.permissions_direct),
              inherited: n(access.permissions_inherited),
            })}
          >
            {access.permissions_total ? (
              <SplitBar
                label={t("person.can.splitLabel", {
                  direct: n(access.permissions_direct),
                  inherited: n(access.permissions_inherited),
                })}
                parts={[
                  {
                    value: access.permissions_direct,
                    color: "var(--qx-color-dataviz-categorical-1)",
                  },
                  { value: access.permissions_inherited, color: "var(--qx-color-border-strong)" },
                ]}
              />
            ) : null}
          </Panel>
          <Panel
            cap={t("person.can.apps")}
            value={
              access.applications_count ? n(access.applications_count) : t("person.signIn.none")
            }
            tone={access.applications_count ? undefined : "none"}
            note={t("person.can.appsNote", { name: first })}
          />
        </Panels>
      )}
    </Section>
  );
}
