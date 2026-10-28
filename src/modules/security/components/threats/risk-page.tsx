import { BotIcon, PlaneIcon, SmartphoneIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  Field,
  formatNumber,
  Radio,
  RadioGroup,
  Slider,
  Switch,
} from "@qeetrix/react";
import { DataState, NumberField, PageContent, PageHeader } from "@qeetrix/react/experimental";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import {
  type RiskSettings,
  useRiskSettings,
  useUpdateRiskSettings,
} from "@/modules/security/api/risk-settings";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  SensitiveActionCancelled,
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { Detail, Failure, Item, Panel, Section } from "../security-parts";
import "../security.css";

// The server's scoring (internal/access/threat/risk, threat/bot): a sign-in's score is its client's
// bot score (0.95 a script or headless browser, 0.90 no user agent, 0.55 not a browser), plus
// these when the signal is on, at most 1.
const TRAVEL = 0.5;
const NEW_DEVICE = 0.25;
const NOT_A_BROWSER = 0.55;
const THRESHOLD = { min: 0.1, max: 1, step: 0.05 };
const MIN_HOURS = 0.5;

const two = (n: number) =>
  formatNumber(n, formatLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Security › Threats › Risk: each sign-in that proves its first factor gets a risk score. One at
 * or above the chosen level must pass two-step verification, even on a remembered device; someone
 * without a second factor confirms a code sent to their verified email instead (risksignin.go).
 * Each section changes on its own, as My account does.
 */
export function RiskPage() {
  const { t } = useTranslation("security");
  const settings = useRiskSettings();
  const canWrite = useCapabilities().can("policy.write");

  return (
    <PageTabs>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("risk.title")}
        description={t("risk.description")}
        tabs={<PageTabList />}
      />
      <PageContent width="narrow">
        {settings.isError ? (
          <DataState error={settings.error} onRetry={() => settings.refetch()} />
        ) : (
          <DataState loading={settings.isLoading}>
            {settings.data ? (
              <>
                <Levels settings={settings.data} canWrite={canWrite} />
                <Signals settings={settings.data} canWrite={canWrite} />
              </>
            ) : null}
          </DataState>
        )}
      </PageContent>
    </PageTabs>
  );
}

/** Saves the whole settings object, as the server stores it, asking for a step-up first. */
function useSave() {
  const { t } = useTranslation("security");
  const runSensitive = useSensitiveAction();
  const update = useUpdateRiskSettings();
  const [failure, setFailure] = useState<string | null>(null);
  const save = (next: RiskSettings) => {
    setFailure(null);
    return runSensitive({
      capability: "policy.write",
      actionLabel: t("risk.action"),
      run: () => update.mutateAsync(next),
    }).catch((err: unknown) => {
      if (!(err instanceof SensitiveActionCancelled)) setFailure(errorMessage(err));
      settleSensitiveAction(err);
      return undefined;
    });
  };
  return { save, pending: update.isPending, failure };
}

function levelOf(s: RiskSettings, score: number): "low" | "medium" | "high" {
  if (score >= s.high_threshold) return "high";
  if (score >= s.medium_threshold) return "medium";
  return "low";
}

function Levels({ settings: s, canWrite }: { settings: RiskSettings; canWrite: boolean }) {
  const { t } = useTranslation("security");
  const { save, pending, failure } = useSave();
  const [editing, setEditing] = useState(false);
  const [range, setRange] = useState<readonly number[]>([s.medium_threshold, s.high_threshold]);
  const [force, setForce] = useState(s.force_mfa_at_level);
  const asks = (level: "medium" | "high") => level === "high" || s.force_mfa_at_level === "medium";
  const [medium = s.medium_threshold, high = s.high_threshold] = range;

  const open = () => {
    setRange([s.medium_threshold, s.high_threshold]);
    setForce(s.force_mfa_at_level);
    setEditing(true);
  };

  return (
    <Section
      title={t("risk.levels.title")}
      description={t("risk.levels.description")}
      action={
        canWrite && !editing ? (
          <Button variant="ghost" onClick={open}>
            {t("common.change")}
          </Button>
        ) : undefined
      }
    >
      {editing ? (
        <Panel title={t("risk.levels.title")}>
          <form
            className="account-panel-form sec-levels-form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void save({
                ...s,
                medium_threshold: medium,
                high_threshold: high,
                force_mfa_at_level: force,
              }).then((saved) => saved && setEditing(false));
            }}
          >
            <Slider
              label={t("risk.levels.start")}
              value={range}
              onValueChange={(value) => setRange(Array.isArray(value) ? value : [value, high])}
              min={THRESHOLD.min}
              max={THRESHOLD.max}
              step={THRESHOLD.step}
              minStepsBetweenValues={1}
              showValue
              description={t("risk.levels.startHint", { medium: two(medium), high: two(high) })}
            />
            <RadioGroup
              label={t("risk.levels.askAt")}
              value={force}
              onValueChange={(value) => setForce(value === "medium" ? "medium" : "high")}
            >
              <Radio
                value="high"
                label={t("risk.levels.askHigh")}
                description={t("risk.levels.askHighHint")}
              />
              <Radio
                value="medium"
                label={t("risk.levels.askMedium")}
                description={t("risk.levels.askMediumHint")}
              />
            </RadioGroup>
            {failure ? <Failure>{failure}</Failure> : null}
            <div className="account-panel-actions">
              <Button variant="ghost" onClick={() => setEditing(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={pending}>
                {t("common.save")}
              </Button>
            </div>
          </form>
        </Panel>
      ) : (
        <dl className="account-details">
          <Detail label={t("risk.levels.low")} hint={t("risk.levels.asUsual")}>
            {t("risk.levels.below", { n: two(s.medium_threshold) })}
          </Detail>
          <Detail
            label={t("risk.levels.medium")}
            hint={asks("medium") ? t("risk.levels.mustPass") : t("risk.levels.asUsual")}
          >
            <span className="sec-level">
              {t("risk.levels.between", {
                from: two(s.medium_threshold),
                to: two(s.high_threshold),
              })}
              {asks("medium") ? (
                <Badge size="sm" tone="info">
                  {t("risk.levels.asksBadge")}
                </Badge>
              ) : null}
            </span>
          </Detail>
          <Detail label={t("risk.levels.high")} hint={t("risk.levels.mustPass")}>
            <span className="sec-level">
              {t("risk.levels.from", { n: two(s.high_threshold) })}
              <Badge size="sm" tone="info">
                {t("risk.levels.asksBadge")}
              </Badge>
            </span>
          </Detail>
        </dl>
      )}
    </Section>
  );
}

function Signals({ settings: s, canWrite }: { settings: RiskSettings; canWrite: boolean }) {
  const { t } = useTranslation("security");
  const { save, pending, failure } = useSave();
  const [hoursOpen, setHoursOpen] = useState(false);
  const [hours, setHours] = useState<number | null>(s.min_travel_hours);
  const example = Math.min(1, NOT_A_BROWSER + NEW_DEVICE);

  return (
    <Section
      title={t("risk.signals.title")}
      description={t("risk.signals.description", {
        app: two(NOT_A_BROWSER),
        device: two(NEW_DEVICE),
        sum: two(example),
        level: t(`risk.levels.${levelOf(s, example)}`).toLowerCase(),
      })}
    >
      <ul className="account-rows">
        <Item
          icon={<BotIcon />}
          name={t("risk.signals.client")}
          badge={<Badge size="sm">{t("risk.signals.alwaysOn")}</Badge>}
          line={t("risk.signals.clientLine")}
        />
        <Item
          icon={<PlaneIcon />}
          name={t("risk.signals.travel")}
          line={t("risk.signals.travelLine", {
            n: two(TRAVEL),
            hours: formatNumber(s.min_travel_hours),
          })}
          actions={
            <>
              {canWrite && !hoursOpen ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setHours(s.min_travel_hours);
                    setHoursOpen(true);
                  }}
                >
                  {t("risk.signals.changeHours")}
                </Button>
              ) : null}
              <Switch
                aria-label={t("risk.signals.travel")}
                checked={s.impossible_travel_enabled}
                disabled={!canWrite || pending}
                onCheckedChange={(on) => void save({ ...s, impossible_travel_enabled: on })}
              />
            </>
          }
        />
        {hoursOpen ? (
          <Panel as="li" title={t("risk.signals.hoursTitle")}>
            <form
              className="account-panel-form"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                if (hours === null || hours < MIN_HOURS) return;
                void save({ ...s, min_travel_hours: hours }).then(
                  (saved) => saved && setHoursOpen(false),
                );
              }}
            >
              <Field
                label={t("risk.signals.hours")}
                description={t("risk.signals.hoursHint", { min: formatNumber(MIN_HOURS) })}
                error={
                  hours !== null && hours < MIN_HOURS
                    ? t("risk.signals.hoursMin", { min: formatNumber(MIN_HOURS) })
                    : undefined
                }
              >
                <NumberField
                  value={hours}
                  onValueChange={setHours}
                  min={MIN_HOURS}
                  step={0.5}
                  endAdornment={t("risk.signals.hoursUnit")}
                />
              </Field>
              <div className="account-panel-actions">
                <Button variant="ghost" onClick={() => setHoursOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" loading={pending}>
                  {t("common.save")}
                </Button>
              </div>
            </form>
          </Panel>
        ) : null}
        <Item
          icon={<SmartphoneIcon />}
          name={t("risk.signals.device")}
          line={t("risk.signals.deviceLine", { n: two(NEW_DEVICE) })}
          actions={
            <Switch
              aria-label={t("risk.signals.device")}
              checked={s.device_reputation_enabled}
              disabled={!canWrite || pending}
              onCheckedChange={(on) => void save({ ...s, device_reputation_enabled: on })}
            />
          }
        />
      </ul>
      {failure ? <Failure>{failure}</Failure> : null}
    </Section>
  );
}
