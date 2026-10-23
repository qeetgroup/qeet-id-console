import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  StatusPill,
} from "@qeetrix/ui";
import { MonitorIcon, LoaderCircleIcon, SmartphoneIcon, TrashIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ErrorText } from "@/platform/components/error-reference";
import { useConfirmDialog } from "@/shared/components/confirm-dialog";
import {
  type TrustedDeviceScope,
  useForgetTrustedDevices,
  useTrustedDevices,
} from "../api/trusted-devices";

/**
 * Renders the devices remembered to skip the second factor, with forgetting one or all; a
 * forgotten device is asked for the second factor at its next sign-in. `scope` is the person's own
 * devices or, for an administrator, a member's devices remembered in their organisation.
 */
export function TrustedDevicesCard({
  scope,
  canForget = true,
  className,
}: {
  scope: TrustedDeviceScope;
  canForget?: boolean; // False shows the devices without the forget actions
  className?: string;
}) {
  const { t } = useTranslation("account");
  const [confirmDialog, openConfirm] = useConfirmDialog();
  const devicesQ = useTrustedDevices(scope);
  const forget = useForgetTrustedDevices(scope);
  const devices = devicesQ.data?.items ?? [];
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });

  function forgetDevices(deviceId?: string) {
    forget.mutate(deviceId, {
      onSuccess: () =>
        toast.success(t(deviceId ? "security.devices.forgotOne" : "security.devices.forgotAll")),
    });
  }

  return (
    <Card className={className}>
      {confirmDialog}
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MonitorIcon className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">{t("security.devices.title")}</CardTitle>
          </div>
          {canForget && devices.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={forget.isPending}
              onClick={() =>
                openConfirm({
                  title: t("security.devices.forgetAllConfirm"),
                  description: t("security.devices.forgetAllDescription"),
                  variant: "destructive",
                  confirmLabel: t("security.devices.forgetAll"),
                  onConfirm: () => forgetDevices(),
                })
              }
            >
              {t("security.devices.forgetAll")}
            </Button>
          )}
        </div>
        <CardDescription>
          {t(
            scope.kind === "self"
              ? "security.devices.description"
              : "security.devices.memberDescription",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {devicesQ.isLoading && (
          <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" />
        )}
        {devicesQ.isError && (
          <p role="alert" className="text-sm text-destructive">
            <ErrorText error={devicesQ.error} />
          </p>
        )}
        {devicesQ.isSuccess && devices.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("security.devices.empty")}</p>
        )}
        {devices.length > 0 && (
          <ul className="divide-y rounded-md border">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-4 px-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  {d.device_kind === "mobile" || d.device_kind === "tablet" ? (
                    <SmartphoneIcon className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <MonitorIcon className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {d.device}
                      {d.current && (
                        <StatusPill status="active" dot={false}>
                          {t("security.devices.thisDevice")}
                        </StatusPill>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t("security.devices.remembered", { date: date(d.created_at) })}
                      {" · "}
                      {d.last_used_at
                        ? t("security.devices.lastUsed", { date: date(d.last_used_at) })
                        : t("security.devices.neverUsed")}
                      {" · "}
                      {t("security.devices.expires", { date: date(d.expires_at) })}
                    </p>
                  </div>
                </div>
                {canForget && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={forget.isPending}
                    onClick={() =>
                      openConfirm({
                        title: t("security.devices.forgetConfirm", { device: d.device }),
                        description: t("security.devices.forgetDescription"),
                        variant: "destructive",
                        confirmLabel: t("security.devices.forget"),
                        onConfirm: () => forgetDevices(d.id),
                      })
                    }
                  >
                    <TrashIcon /> {t("security.devices.forget")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {forget.error ? (
          <p role="alert" className="text-sm text-destructive">
            <ErrorText error={forget.error} />
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
