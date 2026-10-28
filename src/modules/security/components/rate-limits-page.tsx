import { Badge, Button, Field, formatNumber } from "@qeetrix/react";
import { DataState, NumberField, PageContent, PageHeader } from "@qeetrix/react/experimental";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { PageBreadcrumb } from "@/modules/dashboard";
import {
  type LimitConfig,
  type TenantLimits,
  useRateLimits,
  useResetRateLimits,
  useUpdateRateLimits,
} from "@/modules/security/api/rate-limits";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  SensitiveActionCancelled,
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { Detail, EditingDetail, Failure, Section } from "./security-parts";
import "./security.css";

type Bucket = keyof TenantLimits;
const BUCKETS = ["tenant", "user", "api_key"] as const satisfies readonly Bucket[];

// The platform's limits, which are also the most an organisation may set (the server refuses
// more: ratelimits.LimitConfig.check). Not in the API yet (a QTID gap), so the server's values
// are here: internal/bootstrap/infra.go, newTenantLim.
const PLATFORM: Record<Bucket, LimitConfig> = {
  tenant: { rate: 100, capacity: 500 },
  user: { rate: 30, capacity: 100 },
  api_key: { rate: 50, capacity: 200 },
};
const MIN_RATE = 0.01; // ratelimits.MinRate: one request every 100 seconds

// The server's fixed limits (internal/bootstrap/router.go; the sign-in link and reset limits in
// infra.go), by what they protect. Read-only: no organisation changes them.
const BUILT_IN = [
  "signIn",
  "directory",
  "codes",
  "pairing",
  "links",
  "tokens",
  "protocols",
] as const;

const same = (a: LimitConfig, b: LimitConfig) => a.rate === b.rate && a.capacity === b.capacity;

/**
 * Security › Rate limits: one page for both of today's. The organisation's three buckets, each
 * lowered in place (the platform's are the ceiling), then the built-in limits, read-only, with the
 * values the server uses. Each limit is a token bucket: it holds a burst and refills at its rate;
 * a request that finds it empty is answered "Too many requests" (429).
 */
export function RateLimitsPage() {
  const { t } = useTranslation("security");
  const limits = useRateLimits();
  const canWrite = useCapabilities().can("policy.write");
  const runSensitive = useSensitiveAction();
  const reset = useResetRateLimits();
  const [editing, setEditing] = useState<Bucket | null>(null);
  const data = limits.data;
  const atDefaults = !!data && BUCKETS.every((b) => same(data[b], PLATFORM[b]));

  const onReset = () =>
    runSensitive({
      capability: "policy.write",
      confirm: {
        title: t("rateLimits.reset.title"),
        description: t("rateLimits.reset.description"),
        confirmLabel: t("rateLimits.reset.confirm"),
        tone: "default",
      },
      actionLabel: t("rateLimits.reset.action"),
      run: () => reset.mutateAsync(),
    })
      .then(() => setEditing(null))
      .catch(settleSensitiveAction);

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("rateLimits.title")}
        description={t("rateLimits.description")}
      />
      <PageContent width="narrow">
        {limits.isError ? (
          <DataState error={limits.error} onRetry={() => limits.refetch()} />
        ) : (
          <Section
            title={t("rateLimits.yours.title")}
            status={
              data ? (
                <Badge size="sm">
                  {atDefaults ? t("rateLimits.yours.defaults") : t("rateLimits.yours.lowered")}
                </Badge>
              ) : undefined
            }
            description={t("rateLimits.yours.description")}
            action={
              canWrite && data && !atDefaults ? (
                <Button variant="ghost" loading={reset.isPending} onClick={onReset}>
                  {t("rateLimits.reset.button")}
                </Button>
              ) : undefined
            }
          >
            <DataState loading={limits.isLoading}>
              {data ? (
                <dl className="account-details">
                  {BUCKETS.map((bucket) =>
                    editing === bucket ? (
                      <EditBucket
                        key={bucket}
                        bucket={bucket}
                        current={data[bucket]}
                        onDone={() => setEditing(null)}
                      />
                    ) : (
                      <Detail
                        key={bucket}
                        label={t(`rateLimits.bucket.${bucket}.label`)}
                        hint={t(`rateLimits.bucket.${bucket}.hint`)}
                        action={
                          canWrite && !editing ? (
                            <Button
                              variant="ghost"
                              aria-label={t("rateLimits.edit.label", {
                                bucket: t(`rateLimits.bucket.${bucket}.label`),
                              })}
                              onClick={() => setEditing(bucket)}
                            >
                              {t("common.change")}
                            </Button>
                          ) : undefined
                        }
                      >
                        <LimitValue limit={data[bucket]} />
                      </Detail>
                    ),
                  )}
                </dl>
              ) : null}
            </DataState>
          </Section>
        )}

        <Section
          title={t("rateLimits.builtIn.title")}
          description={t("rateLimits.builtIn.description")}
        >
          <dl className="account-details">
            {BUILT_IN.map((id) => (
              <Detail
                key={id}
                label={t(`rateLimits.builtIn.${id}.label`)}
                hint={t(`rateLimits.builtIn.${id}.hint`)}
              >
                {t(`rateLimits.builtIn.${id}.value`)}
              </Detail>
            ))}
          </dl>
        </Section>
      </PageContent>
    </>
  );
}

/** "30 a second, bursts of 100"; a rate under one a second as one every N seconds. */
function LimitValue({ limit }: { limit: LimitConfig }) {
  const { t } = useTranslation("security");
  const n = (value: number) => formatNumber(value, formatLocale(), { maximumFractionDigits: 2 });
  const burst = n(limit.capacity);
  return limit.rate >= 1
    ? t("rateLimits.value.perSecond", { rate: n(limit.rate), burst })
    : t("rateLimits.value.every", { seconds: n(1 / limit.rate), burst });
}

/** One bucket changed in place: its rate and burst, each up to the platform's. */
function EditBucket({
  bucket,
  current,
  onDone,
}: {
  bucket: Bucket;
  current: LimitConfig;
  onDone: () => void;
}) {
  const { t } = useTranslation("security");
  const runSensitive = useSensitiveAction();
  const update = useUpdateRateLimits();
  const ceiling = PLATFORM[bucket];
  const [rate, setRate] = useState<number | null>(current.rate);
  const [capacity, setCapacity] = useState<number | null>(current.capacity);
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const n = (value: number) => formatNumber(value, formatLocale());
  const rateError =
    rate === null || rate < MIN_RATE || rate > ceiling.rate
      ? t("rateLimits.edit.rateRange", { min: n(MIN_RATE), max: n(ceiling.rate) })
      : undefined;
  const capacityError =
    capacity === null || !Number.isInteger(capacity) || capacity < 1 || capacity > ceiling.capacity
      ? t("rateLimits.edit.burstRange", { max: n(ceiling.capacity) })
      : undefined;

  const submit = () => {
    setTouched(true);
    if (rateError || capacityError || rate === null || capacity === null) return;
    setFailure(null);
    // Only this bucket is sent; the server leaves the others as they are.
    runSensitive({
      capability: "policy.write",
      actionLabel: t("rateLimits.edit.action"),
      run: () => update.mutateAsync({ [bucket]: { rate, capacity } }),
    })
      .then((saved) => saved && onDone())
      .catch((err: unknown) => {
        if (!(err instanceof SensitiveActionCancelled)) setFailure(errorMessage(err));
        settleSensitiveAction(err);
      });
  };

  return (
    <EditingDetail
      label={t(`rateLimits.bucket.${bucket}.label`)}
      buttons={
        <>
          <Button variant="ghost" onClick={onDone}>
            {t("common.cancel")}
          </Button>
          <Button loading={update.isPending} onClick={submit}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="sec-pair">
        <Field
          label={t("rateLimits.edit.rate")}
          description={t("rateLimits.edit.rateHint", { max: n(ceiling.rate) })}
          error={touched ? rateError : undefined}
        >
          <NumberField
            value={rate}
            onValueChange={setRate}
            min={MIN_RATE}
            max={ceiling.rate}
            step={1}
          />
        </Field>
        <Field
          label={t("rateLimits.edit.burst")}
          description={t("rateLimits.edit.burstHint", { max: n(ceiling.capacity) })}
          error={touched ? capacityError : undefined}
        >
          <NumberField
            value={capacity}
            onValueChange={setCapacity}
            min={1}
            max={ceiling.capacity}
            step={1}
          />
        </Field>
      </div>
      {failure ? <Failure>{failure}</Failure> : null}
    </EditingDetail>
  );
}
