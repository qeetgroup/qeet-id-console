import { LogOutIcon, MonitorIcon, SmartphoneIcon, TabletIcon } from "@qeetrix/icons";
import { Badge, Button, Card, formatRelativeTime, Text } from "@qeetrix/react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "sonner";

import { formatLocale } from "@/i18n";
import {
  type Session,
  sessionCountry,
  sessionDevice,
  sessionStatus,
  useRevokeOtherSessions,
  useRevokeSession,
  useSessions,
  useSignOutEverywhere,
} from "@/modules/authentication";
import { useSessionId } from "@/platform/auth/session";
import { toastError } from "@/platform/errors/error-toast";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { isStepUpRequired } from "@/platform/security/step-up";
import { formatIp } from "@/shared/utils/ip-format";
import { AccountPage, LoadFailed, Loading, Section } from "./account-parts";

function DeviceIcon({ session, large }: { session: Session; large?: boolean }) {
  const Icon =
    session.device_kind === "mobile"
      ? SmartphoneIcon
      : session.device_kind === "tablet"
        ? TabletIcon
        : MonitorIcon;
  return (
    <span className={large ? "account-icon account-icon-lg" : "account-icon"} aria-hidden="true">
      <Icon />
    </span>
  );
}

/** Where it was opened from: the country, when known, and the address. */
function place(session: Session, locale: string): string {
  return [sessionCountry(session, locale), formatIp(session.ip)].filter(Boolean).join(" · ");
}

/**
 * Where the person is signed in: this device first, then every other session with a way to end
 * it, then the way to end them all, this one included.
 */
export function AccountSessionsPage() {
  const { t } = useTranslation("account");
  const sessions = useSessions();
  const sessionId = useSessionId();
  const locale = formatLocale();
  const active = (sessions.data?.items ?? []).filter((s) => sessionStatus(s) === "active");
  const isHere = (s: Session) => s.current ?? s.id === sessionId;
  const here = active.find(isHere);
  const others = active.filter((s) => !isHere(s));

  return (
    <AccountPage title={t("sessions.title")} description={t("sessions.description")}>
      {sessions.isPending ? (
        <Loading rows={3} />
      ) : sessions.isError ? (
        <LoadFailed error={sessions.error} onRetry={() => void sessions.refetch()} />
      ) : (
        <>
          {here && (
            <Section title={t("sessions.here.title")}>
              <div className="account-current">
                <DeviceIcon session={here} large />
                <span className="account-row-text">
                  <span className="account-row-name">
                    <strong title={here.user_agent ?? undefined}>{sessionDevice(here)}</strong>
                    <Badge tone="success" size="sm">
                      {t("sessions.here.activeNow")}
                    </Badge>
                  </span>
                  <small>{place(here, locale)}</small>
                  <small>
                    {t("sessions.here.signedIn", {
                      when: formatRelativeTime(new Date(here.created_at), locale),
                    })}
                    {here.expires_at &&
                      ` · ${t("sessions.here.ends", {
                        when: formatRelativeTime(new Date(here.expires_at), locale),
                      })}`}
                  </small>
                </span>
              </div>
            </Section>
          )}
          <OtherSessions others={others} locale={locale} />
        </>
      )}
      <SignOutEverywhere />
    </AccountPage>
  );
}

function OtherSessions({ others, locale }: { others: Session[]; locale: string }) {
  const { t } = useTranslation("account");
  const runSensitive = useSensitiveAction();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();

  const signOut = (session: Session) =>
    runSensitive({
      confirm: {
        title: t("sessions.signOut.title", { device: sessionDevice(session) }),
        description: t("sessions.signOut.description"),
        confirmLabel: t("sessions.signOut.button"),
        tone: "destructive",
      },
      actionLabel: t("sessions.signOut.action"),
      run: () => revoke.mutateAsync(session.id),
    }).catch(settleSensitiveAction);

  // One all-or-nothing call: the server ends every session but this one, including any not
  // listed here, so it's always offered.
  const signOutOthers = () =>
    runSensitive({
      confirm: {
        title: t("sessions.others.confirmTitle"),
        description: t("sessions.others.confirmDescription"),
        confirmLabel: t("sessions.others.signOutAll"),
        tone: "destructive",
      },
      actionLabel: t("sessions.others.signOutAll"),
      // The hook is silent, so a failure toasts here; a refused step-up has already said so.
      run: () =>
        revokeOthers.mutateAsync(undefined, {
          onError: (err) => {
            if (!isStepUpRequired(err)) toastError(err, t("sessions.others.failed"));
          },
        }),
    })
      .then((res) => {
        if (!res) return;
        if (res.revoked === 0) toast.success(t("sessions.others.none"));
        else
          toast.success(t("sessions.others.done", { count: res.revoked }), {
            description: t("sessions.others.doneDescription"),
          });
      })
      .catch(settleSensitiveAction);

  return (
    <Section
      title={t("sessions.others.title")}
      status={
        others.length > 0 && (
          <Badge tone="neutral" size="sm">
            {others.length}
          </Badge>
        )
      }
      description={
        others.length > 0 ? t("sessions.others.description") : t("sessions.others.empty")
      }
      action={
        <Button variant="ghost" loading={revokeOthers.isPending} onClick={signOutOthers}>
          {t("sessions.others.signOutAll")}
        </Button>
      }
    >
      {others.length > 0 && (
        <>
          <ul className="account-rows">
            {others.map((session) => (
              <li key={session.id} className="account-session">
                <DeviceIcon session={session} />
                <span className="account-row-text">
                  <strong title={session.user_agent ?? undefined}>{sessionDevice(session)}</strong>
                  <small>
                    {place(session, locale)} ·{" "}
                    {t("sessions.others.signedIn", {
                      when: formatRelativeTime(new Date(session.created_at), locale),
                    })}
                  </small>
                </span>
                <span className="account-session-when">
                  <small>{t("sessions.others.lastActive")}</small>
                  {formatRelativeTime(new Date(session.last_seen_at), locale)}
                </span>
                <Button
                  variant="ghost"
                  disabled={revoke.isPending && revoke.variables === session.id}
                  aria-label={t("sessions.signOut.label", { device: sessionDevice(session) })}
                  onClick={() => signOut(session)}
                >
                  {t("sessions.signOut.button")}
                </Button>
              </li>
            ))}
          </ul>
          <p className="account-note">
            <Trans
              t={t}
              i18nKey="sessions.others.unrecognised"
              components={{ security: <Link to="/account/security" /> }}
            />
          </p>
        </>
      )}
    </Section>
  );
}

/** Ends every session, this console's too: then the cache goes and so does the person, to sign in. */
function SignOutEverywhere() {
  const { t } = useTranslation("account");
  const qc = useQueryClient();
  const navigate = useNavigate();
  const runSensitive = useSensitiveAction();
  const everywhere = useSignOutEverywhere();

  const run = () =>
    runSensitive({
      confirm: {
        title: t("sessions.everywhere.confirmTitle"),
        description: t("sessions.everywhere.confirmDescription"),
        confirmLabel: t("sessions.everywhere.button"),
        tone: "destructive",
      },
      actionLabel: t("sessions.everywhere.button"),
      run: () =>
        everywhere.mutateAsync(undefined, {
          onError: (err) => {
            if (!isStepUpRequired(err)) toastError(err, t("sessions.everywhere.failed"));
          },
        }),
    })
      .then((res) => {
        if (!res) return;
        toast.success(t("sessions.everywhere.done", { count: res.revoked }), {
          description: t("sessions.everywhere.doneDescription"),
        });
        qc.clear();
        void navigate({ to: "/sign-in" });
      })
      .catch(settleSensitiveAction);

  return (
    <Card
      tone="danger"
      title={t("sessions.everywhere.title")}
      level={3}
      className="account-danger"
      actions={
        <Button tone="danger" icon={LogOutIcon} loading={everywhere.isPending} onClick={run}>
          {t("sessions.everywhere.button")}
        </Button>
      }
    >
      <Text tone="subtle" size="sm">
        {t("sessions.everywhere.description")}
      </Text>
    </Card>
  );
}
