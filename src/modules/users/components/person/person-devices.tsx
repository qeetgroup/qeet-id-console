// The devices on the person's Security view: the phones that approve their sign-ins and the devices
// remembered to skip the second step, each with a way to take it away.

import { MonitorIcon, SmartphoneIcon, TabletIcon } from "@qeetrix/icons";
import { Button, formatDate, formatRelativeTime, Skeleton } from "@qeetrix/react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import {
  type TrustedDevice,
  useForgetTrustedDevices,
  usePushDevices,
  useRemovePushDevice,
  useTrustedDevices,
} from "@/modules/authentication";
import type { UserDetail } from "@/modules/users/api/user360";
import { personNames } from "@/modules/users/person-model";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import type { Standing } from "./person-page";
import { Row, Rows, Section } from "./person-parts";

/** The phones that approve the person's sign-ins (Qeet Auth): one can go without a full reset. */
export function PhonesSection({ user, standing }: { user: UserDetail; standing: Standing }) {
  const { t } = useTranslation("users");
  const locale = formatLocale();
  const scope = { kind: "member", userId: user.id } as const;
  const phones = usePushDevices(scope);
  const remove = useRemovePushDevice(scope);
  const runSensitive = useSensitiveAction();
  const { full, first } = personNames(user);
  const items = phones.data?.items ?? [];
  if (!phones.isLoading && !items.length) return null;
  return (
    <Section
      title={t("person.security.phonesHeading")}
      count={items.length || undefined}
      note={t("person.security.phonesNote", { name: first })}
    >
      {phones.isLoading ? (
        <Skeleton lines={2} />
      ) : (
        <Rows label={t("person.security.phonesHeading")}>
          {items.map((phone) => (
            <Row
              key={phone.id}
              icon={SmartphoneIcon}
              name={phone.name}
              line={t("person.security.phoneLine", {
                platform: phone.platform === "ios" ? "iOS" : "Android",
                linked: formatDate(phone.created_at, locale, { dateStyle: "medium" }),
                seen: formatRelativeTime(Date.parse(phone.last_seen_at), locale),
              })}
              end={
                standing.manage ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t("person.security.removePhoneLabel", { phone: phone.name })}
                    disabled={remove.isPending}
                    onClick={() =>
                      void runSensitive({
                        confirm: {
                          title: t("person.confirm.removePhone.title", {
                            phone: phone.name,
                            name: full,
                          }),
                          description: t("person.confirm.removePhone.description"),
                          confirmLabel: t("person.confirm.removePhone.button"),
                          tone: "destructive",
                        },
                        actionLabel: t("person.confirm.removePhone.button"),
                        run: () => remove.mutateAsync(phone.id),
                      }).catch(settleSensitiveAction)
                    }
                  >
                    {t("person.security.remove")}
                  </Button>
                ) : undefined
              }
            />
          ))}
        </Rows>
      )}
    </Section>
  );
}

function deviceIcon(device: TrustedDevice) {
  return device.device_kind === "mobile"
    ? SmartphoneIcon
    : device.device_kind === "tablet"
      ? TabletIcon
      : MonitorIcon;
}

/** Devices remembered in this organisation: they skip the second step until they expire. */
export function DevicesSection({ user, standing }: { user: UserDetail; standing: Standing }) {
  const { t } = useTranslation("users");
  const locale = formatLocale();
  const scope = { kind: "member", userId: user.id } as const;
  const devices = useTrustedDevices(scope);
  const forget = useForgetTrustedDevices(scope);
  const runSensitive = useSensitiveAction();
  const { full, first } = personNames(user);
  const items = devices.data?.items ?? [];

  const run = (device?: TrustedDevice) =>
    void runSensitive({
      confirm: device
        ? {
            title: t("person.confirm.forget.title", { device: device.device }),
            description: t("person.confirm.forget.description", { name: first }),
            confirmLabel: t("person.confirm.forget.button"),
            tone: "destructive",
          }
        : {
            title: t("person.confirm.forgetAll.title", { name: full }),
            description: t("person.confirm.forgetAll.description", { name: first }),
            confirmLabel: t("person.confirm.forgetAll.button"),
            tone: "destructive",
          },
      actionLabel: t("person.confirm.forget.button"),
      run: () => forget.mutateAsync(device?.id),
    }).catch(settleSensitiveAction);

  return (
    <Section
      title={t("person.security.devicesHeading")}
      count={items.length || undefined}
      note={t("person.security.devicesNote")}
      action={
        standing.manage && items.length > 1 ? (
          <Button variant="ghost" size="sm" loading={forget.isPending} onClick={() => run()}>
            {t("person.security.forgetAll")}
          </Button>
        ) : undefined
      }
    >
      {devices.isLoading ? (
        <Skeleton lines={2} />
      ) : items.length ? (
        <Rows label={t("person.security.devicesHeading")}>
          {items.map((d) => (
            <Row
              key={d.id}
              icon={deviceIcon(d)}
              name={d.device}
              line={[
                t("person.security.remembered", {
                  when: formatRelativeTime(Date.parse(d.created_at), locale),
                }),
                d.last_used_at
                  ? t("person.security.used", {
                      when: formatRelativeTime(Date.parse(d.last_used_at), locale),
                    })
                  : null,
                t("person.security.expires", {
                  date: formatDate(d.expires_at, locale, { dateStyle: "medium" }),
                }),
              ]
                .filter(Boolean)
                .join(" · ")}
              end={
                standing.manage ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t("person.security.forgetLabel", { device: d.device })}
                    disabled={forget.isPending}
                    onClick={() => run(d)}
                  >
                    {t("person.security.forget")}
                  </Button>
                ) : undefined
              }
            />
          ))}
        </Rows>
      ) : (
        <p className="prs-note">{t("person.security.noDevices", { name: first })}</p>
      )}
    </Section>
  );
}
