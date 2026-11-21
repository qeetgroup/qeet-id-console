import { CircleCheckIcon } from "@qeetrix/icons";
import { Badge } from "@qeetrix/react";
import { Alert, DataState, EmptyState, RelativeTime } from "@qeetrix/react/experimental";
import { Trans, useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { type HealthComponent, type HealthIncident, useServiceHealth } from "../api/service-health";
import {
  componentOf,
  incidentTone,
  REASON_LABEL,
  reasonOf,
  STATE_BADGE_TONE,
  splitIncidents,
  stateOf,
} from "../service-health-model";
import { DevSection } from "./parts";

/**
 * Infrastructure › Service health: each part of Qeet ID the organization uses with its state and
 * when it was checked, then the incidents the Qeet ID team posted. The state is the server's, read
 * again every minute while the page is open.
 */
export function ServiceHealthSection() {
  const { t } = useTranslation("developer");
  const healthQ = useServiceHealth();
  const health = healthQ.data;
  const overall = health ? stateOf(health.status) : undefined;

  return (
    <DevSection
      id="infra-health"
      title={t("infrastructure.health.title")}
      note={t("infrastructure.health.note")}
      action={
        overall ? (
          <Badge tone={STATE_BADGE_TONE[overall]} size="sm">
            {t(`infrastructure.health.state.${overall}`)}
          </Badge>
        ) : undefined
      }
    >
      <DataState
        loading={healthQ.isLoading}
        error={healthQ.isError ? healthQ.error : undefined}
        onRetry={() => void healthQ.refetch()}
      >
        {health ? (
          <>
            <ComponentRows components={health.components} checkedAt={health.checked_at} />
            <Incidents incidents={health.incidents} />
          </>
        ) : null}
      </DataState>
    </DevSection>
  );
}

function ComponentRows({
  components,
  checkedAt,
}: {
  components: readonly HealthComponent[];
  checkedAt: string;
}) {
  const { t } = useTranslation("developer");
  const locale = formatLocale();
  return (
    <dl className="dev-service-list">
      {components.map((component) => {
        const name = componentOf(component.name);
        const state = stateOf(component.state);
        const reason = reasonOf(component.reason);
        return (
          <div key={component.name} className="dev-service-row">
            <dt>{t(`infrastructure.health.component.${name}.label`)}</dt>
            <dd>
              <span>
                {reason
                  ? t(REASON_LABEL[reason])
                  : t(`infrastructure.health.component.${name}.what`)}
              </span>
              <small>
                <Trans
                  t={t}
                  i18nKey="infrastructure.health.checked"
                  components={{ when: <RelativeTime date={checkedAt} locale={locale} /> }}
                />
              </small>
            </dd>
            <dd className="dev-service-state">
              <Badge tone={STATE_BADGE_TONE[state]} size="sm">
                {t(`infrastructure.health.state.${state}`)}
              </Badge>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Open incidents as alerts, then those resolved in the last 14 days; an empty state for none. */
function Incidents({ incidents }: { incidents: readonly HealthIncident[] }) {
  const { t } = useTranslation("developer");
  const locale = formatLocale();
  const { open, resolved } = splitIncidents(incidents);
  const part = (name: string) => t(`infrastructure.health.component.${componentOf(name)}.label`);

  if (!open.length && !resolved.length)
    return (
      <EmptyState
        size="section"
        icon={CircleCheckIcon}
        title={t("infrastructure.health.incidents.empty.title")}
        description={t("infrastructure.health.incidents.empty.description")}
      />
    );

  return (
    <div className="dev-incidents">
      <h3 className="dev-subhead">{t("infrastructure.health.incidents.openTitle")}</h3>
      {open.length ? (
        open.map((incident) => (
          <Alert key={incident.id} tone={incidentTone(incident.impact)} title={incident.title}>
            {incident.detail ? <p>{incident.detail}</p> : null}
            <small>
              <Trans
                t={t}
                i18nKey="infrastructure.health.incidents.openMeta"
                values={{ component: part(incident.component) }}
                components={{ when: <RelativeTime date={incident.started_at} locale={locale} /> }}
              />
            </small>
          </Alert>
        ))
      ) : (
        <p className="dev-quiet">{t("infrastructure.health.incidents.noneOpen")}</p>
      )}
      {resolved.length ? (
        <>
          <h3 className="dev-subhead">{t("infrastructure.health.incidents.resolvedTitle")}</h3>
          <ul className="dev-incident-list">
            {resolved.map((incident) => (
              <li key={incident.id}>
                <span>{incident.title}</span>
                <small>
                  <Trans
                    t={t}
                    i18nKey="infrastructure.health.incidents.resolvedMeta"
                    values={{ component: part(incident.component) }}
                    components={{
                      when: (
                        <RelativeTime
                          date={incident.resolved_at ?? incident.started_at}
                          locale={locale}
                        />
                      ),
                    }}
                  />
                </small>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
