import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { DataState } from "@/platform/components/data-state";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  revokeOtherSessions,
  type Session,
  sessionCountry,
  sessionDevice,
  sessionStatus,
  signOutEverywhere,
} from "@/modules/authentication";
import { formatIp } from "@/shared/utils/ip-format";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  LogOutIcon,
  MonitorIcon,
  MonitorSmartphoneIcon,
  SmartphoneIcon,
  TabletIcon,
} from "@qeetrix/icons";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useConfirmDialog } from "@/shared/components/confirm-dialog";
import { api } from "@/platform/api/client";
import { useSessionId, useUserId } from "@/platform/auth/session";
import { errorMessage } from "@/platform/errors/user-message";

export const Route = createFileRoute("/account/sessions")({
  component: SessionsPage,
});

type DeviceKind = NonNullable<Session["device_kind"]>;

function DeviceIcon({ kind }: { kind?: DeviceKind }) {
  if (kind === "mobile") return <SmartphoneIcon className="size-4" />;
  if (kind === "tablet") return <TabletIcon className="size-4" />;
  return <MonitorIcon className="size-4" />;
}

function SessionsPage() {
  const { t } = useTranslation("account");
  const userId = useUserId();
  const qc = useQueryClient();
  const currentSessionId = useSessionId();
  const navigate = useNavigate();
  const [confirmDialog, openConfirm] = useConfirmDialog();

  const sessionsQ = useQuery({
    queryKey: ["account-sessions", userId],
    queryFn: () => api<{ items: Session[] }>(`/v1/auth/sessions`),
    enabled: !!userId,
  });

  const revokeM = useMutation({
    mutationFn: (id: string) => api<void>(`/v1/auth/sessions/${id}`, { method: "DELETE" }),
    // Optimistic: stamp `revoked_at` locally so the pill flips at once; roll back on failure.
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["account-sessions"] });
      const snapshots = qc.getQueriesData<{ items: Session[] }>({
        queryKey: ["account-sessions"],
      });
      const now = new Date().toISOString();
      qc.setQueriesData<{ items: Session[] }>({ queryKey: ["account-sessions"] }, (prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((s) =>
                s.id === id ? { ...s, revoked_at: now, status: "revoked" as const } : s,
              ),
            }
          : prev,
      );
      return { snapshots };
    },
    onError: (_err, _id, ctx) => {
      ctx?.snapshots.forEach(([key, snap]) => {
        qc.setQueryData(key, snap);
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["account-sessions"] }),
    meta: { successMessage: t("sessions.toast.revoked") },
  });

  // One all-or-nothing call: the server ends every session but the console's own, including any
  // not loaded here, so the action is always offered.
  const revokeOthersM = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: ({ revoked }) => {
      if (revoked === 0) {
        toast.success(t("sessions.revokeAll.toast.none"));
        return;
      }
      toast.success(t("sessions.revokeAll.toast.done", { count: revoked }), {
        description: t("sessions.revokeAll.toast.doneDescription"),
      });
    },
    onError: (err) =>
      toast.error(t("sessions.revokeAll.toast.failed"), { description: errorMessage(err) }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["account-sessions"] }),
    meta: { silent: true }, // this screen reports both outcomes itself
  });

  // This ends the console's own session too: on success drop the cache and go to sign-in; on
  // failure the person is still signed in and can retry.
  const signOutEverywhereM = useMutation({
    mutationFn: signOutEverywhere,
    onSuccess: ({ revoked }) => {
      toast.success(t("sessions.signOutEverywhere.toast.done", { count: revoked }), {
        description: t("sessions.signOutEverywhere.toast.doneDescription"),
      });
      qc.clear();
      navigate({ to: "/sign-in" });
    },
    onError: (err) =>
      toast.error(t("sessions.signOutEverywhere.toast.failed"), {
        description: errorMessage(err),
      }),
    meta: { silent: true }, // this screen reports both outcomes itself
  });

  const items = sessionsQ.data?.items ?? [];

  return (
    <>
      {confirmDialog}
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
            onClick={() =>
              openConfirm({
                title: t("sessions.revokeAll.title"),
                description: t("sessions.revokeAll.description"),
                variant: "destructive",
                confirmLabel: t("sessions.revokeAll.label"),
                onConfirm: () => revokeOthersM.mutate(),
              })
            }
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
                            openConfirm({
                              title: t("sessions.revoke.title"),
                              description: t("sessions.revoke.description"),
                              variant: "destructive",
                              confirmLabel: t("sessions.revoke.label"),
                              onConfirm: () => revokeM.mutate(s.id),
                            })
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
            onClick={() =>
              openConfirm({
                title: t("sessions.signOutEverywhere.confirm.title"),
                description: t("sessions.signOutEverywhere.confirm.description"),
                variant: "destructive",
                confirmLabel: t("sessions.signOutEverywhere.confirm.label"),
                onConfirm: () => signOutEverywhereM.mutate(),
              })
            }
          >
            <LogOutIcon />
            {t("sessions.signOutEverywhere.button")}
          </Button>
        </CardHeader>
      </Card>
    </>
  );
}
