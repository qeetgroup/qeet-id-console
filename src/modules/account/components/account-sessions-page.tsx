import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { DataState } from "@/platform/components/data-state";
import { StatusPill } from "@/platform/components/status-pill";
import { useQueryClient } from "@tanstack/react-query";
import {
  useRevokeOtherSessions,
  useRevokeSession,
  useSessions,
  useSignOutEverywhere,
  type Session,
  sessionCountry,
  sessionDevice,
  sessionStatus,
} from "@/modules/authentication";
import { formatIp } from "@/shared/utils/ip-format";
import { useNavigate } from "@tanstack/react-router";
import {
  LogOutIcon,
  MonitorIcon,
  MonitorSmartphoneIcon,
  SmartphoneIcon,
  TabletIcon,
} from "@qeetrix/icons";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useSessionId } from "@/platform/auth/session";
import { toastError } from "@/platform/errors/error-toast";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { isStepUpRequired } from "@/platform/security/step-up";

type DeviceKind = NonNullable<Session["device_kind"]>;

function DeviceIcon({ kind }: { kind?: DeviceKind }) {
  if (kind === "mobile") return <SmartphoneIcon className="size-4" />;
  if (kind === "tablet") return <TabletIcon className="size-4" />;
  return <MonitorIcon className="size-4" />;
}

/** Renders the signed-in person's sessions: revoke one, sign out the others, or everywhere. */
export function AccountSessionsPage() {
  const { t } = useTranslation("account");
  const qc = useQueryClient();
  const currentSessionId = useSessionId();
  const navigate = useNavigate();
  const runSensitive = useSensitiveAction();

  const sessionsQ = useSessions();
  const revokeM = useRevokeSession();
  const revokeOthersM = useRevokeOtherSessions();
  const signOutEverywhereM = useSignOutEverywhere();

  // One all-or-nothing call: the server ends every session but the console's own, including any
  // not loaded here, so the action is always offered.
  const revokeOthers = () =>
    runSensitive({
      confirm: {
        title: t("sessions.revokeAll.title"),
        description: t("sessions.revokeAll.description"),
        confirmLabel: t("sessions.revokeAll.label"),
        tone: "destructive",
      },
      actionLabel: t("sessions.active.signOutOthers"),
      // The hook is silent, so a failure toasts here; a refused step-up has already said so.
      run: () =>
        revokeOthersM.mutateAsync(undefined, {
          onError: (err) => {
            if (!isStepUpRequired(err)) toastError(err, t("sessions.revokeAll.toast.failed"));
          },
        }),
    })
      .then((res) => {
        if (!res) return;
        if (res.revoked === 0) toast.success(t("sessions.revokeAll.toast.none"));
        else
          toast.success(t("sessions.revokeAll.toast.done", { count: res.revoked }), {
            description: t("sessions.revokeAll.toast.doneDescription"),
          });
      })
      .catch(settleSensitiveAction);

  // This ends the console's own session too: on success drop the cache and go to sign-in; on
  // failure the person is still signed in and can retry.
  const signOutEverywhere = () =>
    runSensitive({
      confirm: {
        title: t("sessions.signOutEverywhere.confirm.title"),
        description: t("sessions.signOutEverywhere.confirm.description"),
        confirmLabel: t("sessions.signOutEverywhere.confirm.label"),
        tone: "destructive",
      },
      actionLabel: t("sessions.signOutEverywhere.button"),
      run: () =>
        signOutEverywhereM.mutateAsync(undefined, {
          onError: (err) => {
            if (!isStepUpRequired(err)) {
              toastError(err, t("sessions.signOutEverywhere.toast.failed"));
            }
          },
        }),
    })
      .then((res) => {
        if (!res) return;
        toast.success(t("sessions.signOutEverywhere.toast.done", { count: res.revoked }), {
          description: t("sessions.signOutEverywhere.toast.doneDescription"),
        });
        qc.clear();
        navigate({ to: "/sign-in" });
      })
      .catch(settleSensitiveAction);

  const items = sessionsQ.data?.items ?? [];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{t("sessions.active.title")}</CardTitle>
            <CardDescription>{t("sessions.active.description")}</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={revokeOthersM.isPending}
            onClick={revokeOthers}
          >
            {t("sessions.active.signOutOthers")}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <DataState
            isLoading={sessionsQ.isLoading}
            isError={sessionsQ.isError}
            error={sessionsQ.error}
            isEmpty={items.filter((s) => sessionStatus(s) === "active").length === 0}
            emptyIcon={MonitorSmartphoneIcon}
            emptyTitle={t("sessions.active.emptyTitle")}
            skeletonRows={3}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("sessions.columns.device")}</TableHead>
                  <TableHead>{t("sessions.columns.ip")}</TableHead>
                  <TableHead>{t("sessions.columns.created")}</TableHead>
                  <TableHead>{t("sessions.columns.lastSeen")}</TableHead>
                  <TableHead>{t("sessions.columns.status")}</TableHead>
                  <TableHead className="text-right">{t("sessions.columns.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((s) => {
                  // The server describes the device and marks the session the
                  // list was requested with.
                  const isCurrent = s.current ?? currentSessionId === s.id;
                  const country = sessionCountry(s);
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <DeviceIcon kind={s.device_kind} />
                          <span
                            className="text-sm font-medium"
                            title={s.user_agent ?? ""} // raw user agent on hover, for support
                          >
                            {sessionDevice(s)}
                            {country && (
                              <span className="ml-1 font-normal text-muted-foreground">
                                · {country}
                              </span>
                            )}
                            {isCurrent && (
                              <span className="ml-2 rounded-full bg-emerald-500/15 px-1.5 py-px text-[10px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                                {t("sessions.active.thisDevice")}
                              </span>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatIp(s.ip)}
                      </TableCell>
                      <TableCell>
                        <TimeSince value={s.created_at} />
                      </TableCell>
                      <TableCell>
                        <TimeSince value={s.last_seen_at} />
                      </TableCell>
                      <TableCell>
                        <StatusPill status={sessionStatus(s)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={sessionStatus(s) !== "active" || revokeM.isPending || isCurrent}
                          title={isCurrent ? t("sessions.revoke.selfHelp") : undefined}
                          onClick={() =>
                            runSensitive({
                              confirm: {
                                title: t("sessions.revoke.title"),
                                description: t("sessions.revoke.description"),
                                confirmLabel: t("sessions.revoke.label"),
                                tone: "destructive",
                              },
                              actionLabel: t("sessions.revoke.action"),
                              run: () => revokeM.mutateAsync(s.id),
                            }).catch(settleSensitiveAction)
                          }
                        >
                          {t("sessions.revoke.button")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </DataState>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{t("sessions.signOutEverywhere.title")}</CardTitle>
            <CardDescription>{t("sessions.signOutEverywhere.description")}</CardDescription>
          </div>
          <Button
            variant="destructive"
            size="sm"
            disabled={signOutEverywhereM.isPending}
            onClick={signOutEverywhere}
          >
            <LogOutIcon />
            {t("sessions.signOutEverywhere.button")}
          </Button>
        </CardHeader>
      </Card>
    </>
  );
}
