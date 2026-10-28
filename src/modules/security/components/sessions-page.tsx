import { MonitorIcon, SmartphoneIcon, TabletIcon } from "@qeetrix/icons";
import { Badge, Button, formatNumber } from "@qeetrix/react";
import { DataState, PageContent, PageHeader } from "@qeetrix/react/experimental";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import {
  type Session,
  sessionCountry,
  sessionDevice,
  sessionStatus,
  useRevokeOtherSessions,
  useRevokeSession,
  useSessions,
} from "@/modules/authentication";
import { useSessionId } from "@/platform/auth/session";
import { toastError } from "@/platform/errors/error-toast";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { isStepUpRequired } from "@/platform/security/step-up";
import { formatIp } from "@/shared/utils/ip-format";
import { Section } from "./security-parts";
import { When } from "./when";
import "./security.css";

function DeviceIcon({ session }: { session: Session }) {
  const Icon =
    session.device_kind === "mobile"
      ? SmartphoneIcon
      : session.device_kind === "tablet"
        ? TabletIcon
        : MonitorIcon;
  return (
    <span className="account-icon" aria-hidden="true">
      <Icon />
    </span>
  );
}

/**
 * Security › Sessions: the signed-in person's own sessions, kept beside My account › Sessions (the
 * user's decision, 2026-10-26) and built the same way: this device, then every other session with
 * a way to end it, and a way to end them all but this one. Signing a session out ends it at once:
 * it can no longer be renewed.
 */
export function SessionsPage() {
  const { t } = useTranslation("security");
  const sessions = useSessions();
  const sessionId = useSessionId();
  const locale = formatLocale();
  const runSensitive = useSensitiveAction();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const active = (sessions.data?.items ?? []).filter((s) => sessionStatus(s) === "active");
  const isHere = (s: Session) => s.current ?? s.id === sessionId;
  const here = active.find(isHere);
  const others = active.filter((s) => !isHere(s));
  const place = (s: Session) =>
    [sessionCountry(s, locale), formatIp(s.ip)].filter(Boolean).join(" · ");

  const signOut = (s: Session) =>
    runSensitive({
      confirm: {
        title: t("sessions.signOut.title", { device: sessionDevice(s) }),
        description: t("sessions.signOut.description"),
        confirmLabel: t("sessions.signOut.button"),
        tone: "destructive",
      },
      actionLabel: t("sessions.signOut.action"),
      run: () => revoke.mutateAsync(s.id),
    }).catch(settleSensitiveAction);

  // One call: the server ends every session but this one, including any not listed here.
  const signOutOthers = () =>
    runSensitive({
      confirm: {
        title: t("sessions.others.confirmTitle"),
        description: t("sessions.others.confirmDescription"),
        confirmLabel: t("sessions.others.signOutAll"),
        tone: "destructive",
      },
      actionLabel: t("sessions.others.signOutAll"),
      run: () =>
        revokeOthers.mutateAsync(undefined, {
          onError: (err) => {
            if (!isStepUpRequired(err)) toastError(err, t("sessions.others.failed"));
          },
        }),
    })
      .then((res) => {
        if (!res) return;
        toast.success(
          res.revoked === 0
            ? t("sessions.others.none")
            : t("sessions.others.done", {
                count: res.revoked,
                n: formatNumber(res.revoked, locale),
              }),
        );
      })
      .catch(settleSensitiveAction);

  return (
    <>
      <PageHeader title={t("sessions.title")} description={t("sessions.description")} />
      <PageContent width="narrow">
        {sessions.isError ? (
          <DataState error={sessions.error} onRetry={() => sessions.refetch()} />
        ) : (
          <DataState loading={sessions.isPending}>
            {here ? (
              <Section title={t("sessions.here.title")}>
                <ul className="account-rows">
                  <li className="account-row">
                    <DeviceIcon session={here} />
                    <span className="account-row-text">
                      <span className="account-row-name">
                        <strong title={here.user_agent ?? undefined}>{sessionDevice(here)}</strong>
                        <Badge tone="success" size="sm">
                          {t("sessions.here.activeNow")}
                        </Badge>
                      </span>
                      <small>
                        {[place(here), t("sessions.signedIn")].filter(Boolean).join(" · ")}{" "}
                        <When at={here.created_at} />
                      </small>
                    </span>
                  </li>
                </ul>
              </Section>
            ) : null}
            <Section
              title={t("sessions.others.title")}
              status={
                others.length ? (
                  <Badge size="sm">{formatNumber(others.length, locale)}</Badge>
                ) : undefined
              }
              description={
                others.length ? t("sessions.others.description") : t("sessions.others.empty")
              }
              action={
                <Button
                  variant="ghost"
                  loading={revokeOthers.isPending}
                  onClick={() => void signOutOthers()}
                >
                  {t("sessions.others.signOutAll")}
                </Button>
              }
            >
              {others.length ? (
                <ul className="account-rows">
                  {others.map((s) => (
                    <li key={s.id} className="account-session">
                      <DeviceIcon session={s} />
                      <span className="account-row-text">
                        <strong title={s.user_agent ?? undefined}>{sessionDevice(s)}</strong>
                        <small>
                          {[place(s), t("sessions.signedIn")].filter(Boolean).join(" · ")}{" "}
                          <When at={s.created_at} />
                        </small>
                      </span>
                      <span className="account-session-when">
                        <small>{t("sessions.lastActive")}</small>
                        <When at={s.last_seen_at} />
                      </span>
                      <Button
                        variant="ghost"
                        disabled={revoke.isPending && revoke.variables === s.id}
                        aria-label={t("sessions.signOut.label", { device: sessionDevice(s) })}
                        onClick={() => void signOut(s)}
                      >
                        {t("sessions.signOut.button")}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Section>
          </DataState>
        )}
      </PageContent>
    </>
  );
}
