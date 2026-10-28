import { AppWindowIcon, KeyRoundIcon, ShieldCheckIcon, UsersIcon } from "@qeetrix/icons";
import { Badge, formatNumber, Meter, Skeleton } from "@qeetrix/react";
import { Alert, DescriptionItem, DescriptionList } from "@qeetrix/react/experimental";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";

import type { Entitlements } from "../api/billing";
import { BILLING_RESOURCES, type BillingResource, billingUsage } from "../billing-model";
import { Item, Section } from "./billing-parts";

const ICONS: Record<BillingResource, typeof UsersIcon> = {
  seats: UsersIcon,
  apps: AppWindowIcon,
  api_keys: KeyRoundIcon,
  custom_roles: ShieldCheckIcon,
};

/**
 * The four counts the plan caps. With no caps they're four figures on one ruled line; with caps,
 * a row each with a meter against the cap, marked at or over it. Seats are what the server
 * counts against the cap: people with a role, plus pending invitations.
 */
export function BillingUsage({
  planName,
  usage,
  entitlements,
  loading,
  error,
}: {
  planName: string;
  usage?: Record<string, number>;
  entitlements?: Entitlements;
  loading: boolean;
  error: boolean;
}) {
  const { t } = useTranslation("billing");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const meters = BILLING_RESOURCES.map((resource) => ({
    resource,
    ...billingUsage(usage?.[resource], entitlements?.limits[resource]),
  }));
  const unlimited = meters.every((meter) => meter.unlimited);

  return (
    <Section
      title={t("usage.title")}
      description={
        loading || error
          ? undefined
          : t(unlimited ? "usage.unlimited" : "usage.limited", { plan: planName })
      }
    >
      {loading ? (
        <Skeleton lines={2} />
      ) : error ? (
        <Alert tone="danger" title={t("usage.failed")} />
      ) : unlimited ? (
        <DescriptionList layout="columns" columns={4} className="bill-usage">
          {meters.map((meter) => (
            <DescriptionItem key={meter.resource} term={t(`usage.name.${meter.resource}`)}>
              {meter.used === null ? t("usage.unavailable") : n(meter.used)}
            </DescriptionItem>
          ))}
        </DescriptionList>
      ) : (
        <ul className="account-rows">
          {meters.map((meter) => {
            const Icon = ICONS[meter.resource];
            const name = t(`usage.name.${meter.resource}`);
            const capped = meter.used !== null && meter.limit !== null && meter.limit > 0;
            return (
              <Item
                key={meter.resource}
                icon={<Icon />}
                name={name}
                badge={
                  meter.exceeded && meter.limit !== 0 ? (
                    <Badge tone="danger" size="sm">
                      {t("usage.over")}
                    </Badge>
                  ) : meter.atLimit ? (
                    <Badge tone="warning" size="sm">
                      {t("usage.atLimit")}
                    </Badge>
                  ) : undefined
                }
                line={
                  meter.used === null || meter.limit === null
                    ? t("usage.unavailable")
                    : meter.unlimited
                      ? t("usage.noLimit", { used: n(meter.used) })
                      : meter.limit === 0
                        ? meter.used > 0
                          ? t("usage.notIncludedUsed", { used: n(meter.used), plan: planName })
                          : t("usage.notIncluded", { plan: planName })
                        : t("usage.of", { used: n(meter.used), limit: n(meter.limit) })
                }
                actions={
                  capped && meter.used !== null && meter.limit !== null ? (
                    <Meter
                      value={Math.min(meter.used, meter.limit)}
                      max={meter.limit}
                      tone={meter.exceeded ? "danger" : meter.atLimit ? "warning" : "neutral"}
                      aria-label={t("usage.meter", {
                        resource: name,
                        used: n(meter.used),
                        limit: n(meter.limit),
                      })}
                      className="bill-meter"
                    />
                  ) : undefined
                }
              />
            );
          })}
        </ul>
      )}
    </Section>
  );
}
