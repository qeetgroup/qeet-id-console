import { LogOutIcon, MonitorIcon, SmartphoneIcon } from "@qeetrix/icons";
import { Button, formatDateTime, formatRelativeTime, Skeleton } from "@qeetrix/react";
import { Alert } from "@qeetrix/react/experimental";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { ActivityEvent } from "@/modules/activity";
import type { UserDetail, UserSession } from "@/modules/users/api/user360";
import { personNames, RULER_DAYS, sessionSpans } from "@/modules/users/person-model";
import { useUserActions } from "@/modules/users/use-user-actions";
import { parseUserAgent } from "@/modules/users/user-agent";
import { errorMessage } from "@/platform/errors/user-message";
import type { Standing } from "./person-page";
import { Row, Rows, Section } from "./person-parts";

/** How many sessions the ruler draws, latest first. */
const RULER_ROWS = 8;

const isPhone = (ua: string | null) => /iPhone|iPad|iPod|Android/.test(ua ?? "");

/**
 * Sessions: where the person is signed in now, each on a ruler of the last two weeks (from when it
 * opened to its last request), then as rows. Signing out everywhere ends them all; the server can't
 * end one of someone else's sessions on its own yet.
 */
export function PersonSessions({
  user,
  standing,
  sessions,
  loading,
  error,
  onRetry,
  now,
  lastSignIn,
}: {
  user: UserDetail;
  standing: Standing;
  sessions: UserSession[];
  loading: boolean;
  error?: unknown;
  onRetry: () => void;
  now: number;
  lastSignIn?: ActivityEvent;
}) {
  const { t } = useTranslation("users");
  const locale = formatLocale();
  const actions = useUserActions();
  const { first } = personNames(user);
  const when = (at: string) => formatRelativeTime(Math.min(Date.parse(at), now), locale, now);

  if (loading) return <Skeleton lines={6} />;
  if (error)
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

  const { spans } = sessionSpans(sessions, now);
  // The ruler shows the latest few; every session is in the rows under it.
  const onRuler = spans.slice(0, RULER_ROWS);
  const byId = new Map(sessions.map((s) => [s.id, s]));

  return (
    <div className="prs-page">
      <Section
        title={t("person.sessions.heading")}
        count={sessions.length}
        note={
          sessions.length
            ? t("person.sessions.note", { name: first })
            : lastSignIn
              ? t("person.sessions.noneSince", { name: first, when: when(lastSignIn.at) })
              : t("person.sessions.none", { name: first })
        }
        action={
          standing.manage && sessions.length ? (
            <Button
              variant="ghost"
              size="sm"
              icon={LogOutIcon}
              loading={actions.pendingAction.revokeSessions}
              onClick={() => void actions.revokeSessions(user)}
            >
              {t("person.header.signOut")}
            </Button>
          ) : undefined
        }
      >
        {sessions.length ? (
          <>
            <div className="prs-ruler" aria-hidden="true">
              {onRuler.map((span) => {
                const s = byId.get(span.id);
                if (!s) return null;
                return (
                  <div key={span.id} className="prs-ruler-row">
                    <span className="prs-ruler-name">{parseUserAgent(s.user_agent).label}</span>
                    <span className="prs-ruler-track">
                      <span
                        className={span.before ? "prs-ruler-span is-before" : "prs-ruler-span"}
                        title={t("person.sessions.spanTitle", {
                          opened: formatDateTime(s.created_at, locale),
                          seen: formatDateTime(s.last_seen_at, locale),
                        })}
                        style={{
                          insetInlineStart: `${span.from * 100}%`,
                          inlineSize: `${Math.max(0, span.to - span.from) * 100}%`,
                        }}
                      />
                    </span>
                  </div>
                );
              })}
              <div className="prs-ruler-axis">
                <span />
                <span>
                  <span>{t("person.sessions.axisStart", { n: RULER_DAYS })}</span>
                  <span>{t("person.sessions.axisNow")}</span>
                </span>
              </div>
            </div>
            {spans.length > onRuler.length ? (
              <p className="prs-note">
                {t("person.sessions.rulerMore", {
                  shown: onRuler.length,
                  count: spans.length,
                })}
              </p>
            ) : null}
            <Rows label={t("person.sessions.heading")}>
              {spans.map((span) => {
                const s = byId.get(span.id);
                if (!s) return null;
                return (
                  <Row
                    key={s.id}
                    icon={isPhone(s.user_agent) ? SmartphoneIcon : MonitorIcon}
                    name={
                      <span title={s.user_agent ?? undefined}>
                        {parseUserAgent(s.user_agent).label}
                      </span>
                    }
                    line={[s.ip, t("person.sessions.signedIn", { when: when(s.created_at) })]
                      .filter(Boolean)
                      .join(" · ")}
                    end={
                      <span className="prs-when">
                        <small>{t("person.sessions.lastActive")}</small>
                        <time
                          dateTime={s.last_seen_at}
                          title={formatDateTime(s.last_seen_at, locale)}
                        >
                          {when(s.last_seen_at)}
                        </time>
                      </span>
                    }
                  />
                );
              })}
            </Rows>
            {standing.manage ? (
              <p className="prs-note">{t("person.sessions.signOutNote", { name: first })}</p>
            ) : null}
          </>
        ) : null}
      </Section>
    </div>
  );
}
