import {
  KeyRoundIcon,
  LifeBuoyIcon,
  LinkIcon,
  LockIcon,
  MessageSquareIcon,
  QrCodeIcon,
  SendIcon,
  ShieldAlertIcon,
  ShieldOffIcon,
  SmartphoneIcon,
} from "@qeetrix/icons";
import {
  Badge,
  Button,
  formatDate,
  formatNumber,
  formatRelativeTime,
  Skeleton,
  Switch,
} from "@qeetrix/react";
import { Alert } from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { isAnomalyResolved, useAnomalies } from "@/modules/security";
import {
  type SecuritySummary,
  type UserDetail,
  useSendPasswordReset,
  useUserSocialIdentities,
} from "@/modules/users/api/user360";
import { personNames, providerName } from "@/modules/users/person-model";
import { useUserActions } from "@/modules/users/use-user-actions";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import type { Standing } from "./person-page";
import { DevicesSection, PhonesSection } from "./person-devices";
import { Row, Rows, Section } from "./person-parts";

/** Words for a raw type, such as `credential_stuffing` → "Credential stuffing". */
function words(value: string) {
  const text = value.replace(/[._]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : value;
}

/**
 * Security: how the person proves who they are, as My account › Security shows them their own,
 * with what an administrator can do about it: reset their second steps, always ask for one, set
 * or send a password, forget a remembered device, remove a linked phone.
 */
export function PersonSecurity({
  user,
  standing,
  security,
  loading,
  error,
  onRetry,
  onSetPassword,
}: {
  user: UserDetail;
  standing: Standing;
  security?: SecuritySummary;
  loading: boolean;
  error?: unknown;
  onRetry: () => void;
  onSetPassword: () => void;
}) {
  const { t } = useTranslation("users");
  if (loading) return <Skeleton lines={8} />;
  if (error || !security)
    return (
      <Alert
        tone="danger"
        title={t("person.loadFailed")}
        actions={
          <Button size="sm" variant="soft" onClick={onRetry}>
            {t("person.tryAgain")}
          </Button>
        }
      >
        {errorMessage(error)}
      </Alert>
    );
  return (
    <div className="prs-page">
      <TwoStepSection user={user} standing={standing} security={security} />
      <PhonesSection user={user} standing={standing} />
      <PasskeysSection user={user} security={security} />
      <PasswordSection
        user={user}
        standing={standing}
        security={security}
        onSetPassword={onSetPassword}
      />
      <DevicesSection user={user} standing={standing} />
      <ConnectedSection user={user} />
      <SignalsSection user={user} />
    </div>
  );
}

function TwoStepSection({
  user,
  standing,
  security,
}: {
  user: UserDetail;
  standing: Standing;
  security: SecuritySummary;
}) {
  const { t } = useTranslation("users");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const actions = useUserActions();
  const { first } = personNames(user);
  const resettable = security.mfa_enabled || security.recovery_codes_remaining > 0;
  return (
    <Section
      title={t("person.security.twoStep")}
      status={
        security.mfa_enabled ? (
          <Badge tone="success" size="sm">
            {t("person.band.on")}
          </Badge>
        ) : (
          <Badge tone="warning" size="sm">
            {t("person.band.off")}
          </Badge>
        )
      }
      note={t("person.security.twoStepNote", { name: first })}
      action={
        standing.manage && resettable ? (
          <Button
            variant="ghost"
            size="sm"
            icon={ShieldOffIcon}
            loading={actions.pendingAction.resetMfa}
            onClick={() => void actions.resetMfa(user)}
          >
            {t("person.security.reset")}
          </Button>
        ) : undefined
      }
    >
      <Rows label={t("person.security.twoStep")}>
        <Row
          icon={QrCodeIcon}
          name={t("person.security.app")}
          badge={
            security.totp_enabled ? (
              <Badge tone="success" size="sm">
                {t("person.band.on")}
              </Badge>
            ) : undefined
          }
          line={security.totp_enabled ? t("person.security.appOn") : t("person.security.notSetUp")}
        />
        <Row
          icon={LifeBuoyIcon}
          name={t("person.security.recovery")}
          line={
            security.recovery_codes_remaining
              ? t("person.security.recoveryLeft", {
                  count: security.recovery_codes_remaining,
                  n: n(security.recovery_codes_remaining),
                })
              : security.mfa_enabled
                ? t("person.security.recoveryNone", { name: first })
                : t("person.signIn.none")
          }
        />
        <Row
          icon={MessageSquareIcon}
          name={t("person.security.codes")}
          line={
            security.otp_factors
              ? t("person.security.codesSet", {
                  count: security.otp_factors,
                  n: n(security.otp_factors),
                })
              : t("person.signIn.none")
          }
        />
        <Row
          icon={SmartphoneIcon}
          name={t("person.security.phones")}
          line={
            security.push_devices
              ? t("person.security.phonesLinked", {
                  count: security.push_devices,
                  n: n(security.push_devices),
                })
              : t("person.security.noPhones")
          }
        />
      </Rows>
      {standing.manage ? (
        <Switch
          label={t("person.security.alwaysRequire")}
          description={t("person.security.alwaysRequireNote", { name: first })}
          checked={security.mfa_required}
          disabled={actions.pendingAction.mfaRequired}
          onCheckedChange={(on) => void actions.setMfaRequired(user, on)}
        />
      ) : (
        <p className="prs-note">
          {security.mfa_required
            ? t("person.security.alwaysOn", { name: first })
            : t("person.security.alwaysOff", { name: first })}
        </p>
      )}
    </Section>
  );
}

function PasskeysSection({ user, security }: { user: UserDetail; security: SecuritySummary }) {
  const { t } = useTranslation("users");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const { first } = personNames(user);
  return (
    <Section
      title={t("person.signIn.passkeys")}
      count={security.passkeys || undefined}
      note={t("person.security.passkeysNote")}
    >
      {security.passkeys ? (
        <Rows label={t("person.signIn.passkeys")}>
          <Row
            icon={KeyRoundIcon}
            name={t("person.security.passkeyCount", {
              count: security.passkeys,
              n: n(security.passkeys),
            })}
            line={
              security.passkey_last_used_at
                ? t("person.signIn.passkeyUsed", {
                    when: formatRelativeTime(Date.parse(security.passkey_last_used_at), locale),
                  })
                : t("person.signIn.passkeyUnused")
            }
          />
        </Rows>
      ) : (
        <p className="prs-note">{t("person.security.noPasskeys", { name: first })}</p>
      )}
    </Section>
  );
}

function PasswordSection({
  user,
  standing,
  security,
  onSetPassword,
}: {
  user: UserDetail;
  standing: Standing;
  security: SecuritySummary;
  onSetPassword: () => void;
}) {
  const { t } = useTranslation("users");
  const locale = formatLocale();
  const sendReset = useSendPasswordReset();
  const { first } = personNames(user);
  return (
    <Section
      title={t("person.signIn.password")}
      note={t("person.security.passwordNote", { name: first })}
    >
      <Rows label={t("person.signIn.password")}>
        <Row
          icon={LockIcon}
          name={t("person.signIn.password")}
          badge={
            <Badge tone="neutral" size="sm">
              {security.password_set ? t("person.signIn.set") : t("person.security.notSet")}
            </Badge>
          }
          line={
            security.password_set
              ? security.password_changed_at
                ? t("person.signIn.passwordSince", {
                    date: formatDate(security.password_changed_at, locale, { dateStyle: "medium" }),
                  })
                : t("person.signIn.passwordSet")
              : t("person.signIn.noPassword", { name: first })
          }
          end={
            standing.manage ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={SendIcon}
                  loading={sendReset.isPending}
                  onClick={() => sendReset.mutate(user.email)}
                >
                  {t("person.header.sendReset")}
                </Button>
                <Button variant="ghost" size="sm" icon={LockIcon} onClick={onSetPassword}>
                  {t("person.header.setPassword")}
                </Button>
              </>
            ) : undefined
          }
        />
      </Rows>
    </Section>
  );
}

/** Accounts elsewhere the person signs in with: single sign-on, a directory, a social account. */
function ConnectedSection({ user }: { user: UserDetail }) {
  const { t } = useTranslation("users");
  const locale = formatLocale();
  const identities = useUserSocialIdentities(user.id);
  const items = identities.data?.items ?? [];
  const { first } = personNames(user);
  return (
    <Section
      title={t("person.signIn.connected")}
      count={items.length || undefined}
      note={t("person.security.connectedNote")}
    >
      {identities.isLoading ? (
        <Skeleton lines={2} />
      ) : items.length ? (
        <Rows label={t("person.signIn.connected")}>
          {items.map((i) => (
            <Row
              key={i.id}
              icon={LinkIcon}
              name={providerName(i.provider)}
              line={[
                i.email || i.subject,
                t("person.security.linked", {
                  date: formatDate(i.linked_at, locale, { dateStyle: "medium" }),
                }),
              ].join(" · ")}
            />
          ))}
        </Rows>
      ) : (
        <p className="prs-note">{t("person.security.noConnected", { name: first })}</p>
      )}
    </Section>
  );
}

/** What the threat detection flagged on the person, and whether it's still open. */
function SignalsSection({ user }: { user: UserDetail }) {
  const { t } = useTranslation("users");
  const locale = formatLocale();
  const can = useCapabilities();
  const anomalies = useAnomalies(can.can("audit.read"));
  const { first } = personNames(user);
  if (!can.can("audit.read")) return null;
  const mine = (anomalies.data?.items ?? []).filter((a) => a.user_id === user.id);
  const open = mine.filter((a) => !isAnomalyResolved(a));
  return (
    <Section
      title={t("person.security.signals")}
      status={
        anomalies.isLoading ? undefined : open.length ? (
          <Badge tone="warning" size="sm">
            {t("person.security.openN", { count: open.length })}
          </Badge>
        ) : (
          <Badge tone="success" size="sm">
            {t("person.security.noneOpen")}
          </Badge>
        )
      }
      note={t("person.security.signalsNote", { name: first })}
      action={
        <Button variant="ghost" size="sm" render={<RouterLink to="/security/threats/anomalies" />}>
          {t("person.security.seeAnomalies")}
        </Button>
      }
    >
      {anomalies.isLoading ? (
        <Skeleton lines={2} />
      ) : mine.length ? (
        <Rows label={t("person.security.signals")}>
          {mine.slice(0, 10).map((a) => (
            <Row
              key={a.id}
              icon={ShieldAlertIcon}
              name={words(a.type)}
              badge={
                <Badge
                  tone={
                    a.severity === "critical" || a.severity === "high"
                      ? "danger"
                      : a.severity === "medium"
                        ? "warning"
                        : "neutral"
                  }
                  size="sm"
                >
                  {t(`person.security.severity.${severityKey(a.severity)}`)}
                </Badge>
              }
              line={[
                formatRelativeTime(Date.parse(a.created_at), locale),
                a.ip,
                isAnomalyResolved(a) ? t("person.security.resolved") : t("person.security.open"),
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          ))}
        </Rows>
      ) : (
        <p className="prs-note">{t("person.security.noSignals", { name: first })}</p>
      )}
    </Section>
  );
}

const severityKey = (severity: string) =>
  severity === "critical" || severity === "high" || severity === "medium" ? severity : "low";
