import { MonitorIcon, SmartphoneIcon, TabletIcon } from "@qeetrix/icons";
import { Badge, Button } from "@qeetrix/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  isStepUpRequired,
  type TrustedDevice,
  useForgetTrustedDevices,
  useTrustedDevices,
} from "@/modules/authentication";
import { toastError } from "@/platform/errors/error-toast";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { relative } from "@/modules/account/relative-time";
import { Item, Loading, Section } from "../account-parts";

const SELF = { kind: "self" } as const;

function DeviceIcon({ kind }: { kind: TrustedDevice["device_kind"] }) {
  if (kind === "mobile") return <SmartphoneIcon />;
  if (kind === "tablet") return <TabletIcon />;
  return <MonitorIcon />;
}

/** Browsers remembered so they skip the second step until they expire: forget one, or all. */
export function DevicesSection() {
  const { t } = useTranslation("account");
  const runSensitive = useSensitiveAction();
  const devices = useTrustedDevices(SELF);
  const forget = useForgetTrustedDevices(SELF);
  const items = devices.data?.items ?? [];

  // The hook is silent, so the outcome toasts here; a cancelled step-up already said so.
  const run = (deviceId: string | undefined, confirm: { title: string; description: string }) =>
    runSensitive({
      confirm: { ...confirm, confirmLabel: t("security.devices.forget"), tone: "destructive" },
      actionLabel: t("security.devices.forget"),
      run: () =>
        forget.mutateAsync(deviceId, {
          onError: (err) => {
            if (!isStepUpRequired(err)) toastError(err);
          },
        }),
    })
      .then(
        (res) =>
          res &&
          toast.success(
            deviceId ? t("security.devices.forgotOne") : t("security.devices.forgotAll"),
          ),
      )
      .catch(settleSensitiveAction);

  return (
    <Section
      title={t("security.devices.title")}
      description={t("security.devices.shortDescription")}
      action={
        items.length > 1 && (
          <Button
            variant="ghost"
            onClick={() =>
              void run(undefined, {
                title: t("security.devices.forgetAllConfirm"),
                description: t("security.devices.forgetAllDescription"),
              })
            }
          >
            {t("security.devices.forgetAll")}
          </Button>
        )
      }
    >
      {devices.isPending ? (
        <Loading rows={1} />
      ) : items.length === 0 ? (
        <p className="account-note">{t("security.devices.empty")}</p>
      ) : (
        <ul className="account-rows">
          {items.map((device) => (
            <Item
              key={device.id}
              icon={<DeviceIcon kind={device.device_kind} />}
              name={device.device}
              badge={
                device.current && (
                  <Badge tone="brand" size="sm">
                    {t("security.devices.thisDevice")}
                  </Badge>
                )
              }
              line={t("security.devices.line", {
                remembered: relative(device.created_at),
                expires: relative(device.expires_at),
              })}
              actions={
                <Button
                  variant="ghost"
                  aria-label={t("security.devices.forgetNamed", { device: device.device })}
                  onClick={() =>
                    void run(device.id, {
                      title: t("security.devices.forgetConfirm", { device: device.device }),
                      description: t("security.devices.forgetDescription"),
                    })
                  }
                >
                  {t("security.devices.forget")}
                </Button>
              }
            />
          ))}
        </ul>
      )}
    </Section>
  );
}
