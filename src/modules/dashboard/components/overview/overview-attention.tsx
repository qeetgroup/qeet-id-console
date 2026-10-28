// What needs someone, beside the sign-ins chart: each item with its severity word, one line of
// detail and its one action. The five most severe show; the rest open in place.

import {
  CircleCheckIcon,
  KeyRoundIcon,
  RadarIcon,
  ShieldAlertIcon,
  TriangleAlertIcon,
  WebhookIcon,
  WebhookOffIcon,
} from "@qeetrix/icons";
import { Badge, Button } from "@qeetrix/react";
import { EmptyState } from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import i18n from "@/i18n";
import type { OverviewAttention } from "@/modules/dashboard/overview-model";
import { Panel } from "./overview-parts";

const SHOWN = 5;
const TONE = { critical: "danger", warning: "warning", info: "info" } as const;

function iconFor(item: OverviewAttention) {
  if (item.id.startsWith("webhook-off")) return WebhookOffIcon;
  if (item.id.startsWith("webhooks")) return WebhookIcon;
  if (item.id.startsWith("anomaly")) return RadarIcon;
  if (item.id.startsWith("keys")) return KeyRoundIcon;
  return item.severity === "critical" ? ShieldAlertIcon : TriangleAlertIcon;
}

export function NeedsAttentionPanel({ items }: { items: OverviewAttention[] }) {
  const { t } = useTranslation("dashboard");
  const [all, setAll] = useState(false);
  const critical = items.filter((i) => i.severity === "critical").length;
  const others = items.length - critical;
  const shown = all ? items : items.slice(0, SHOWN);
  return (
    <Panel
      flush
      title={t("overview.attention.title")}
      note={
        items.length ? (
          <>
            {critical ? (
              <Badge tone="danger" size="sm">
                {t("overview.attention.critical", { count: critical })}
              </Badge>
            ) : null}
            {others ? <span>{t("overview.attention.others", { count: others })}</span> : null}
          </>
        ) : undefined
      }
    >
      {items.length ? (
        <>
          <ul className="overview-rows">
            {shown.map((item) => {
              const Icon = iconFor(item);
              return (
                <li key={item.id} className="overview-row">
                  <span className="overview-row-icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="overview-row-text">
                    <span className="overview-row-name">
                      <strong>{i18n.t(item.title, item.params)}</strong>
                      <Badge tone={TONE[item.severity]} size="sm">
                        {t(`insights.severity.${item.severity}`)}
                      </Badge>
                    </span>
                    <small>{i18n.t(item.detail, item.params)}</small>
                  </span>
                  <Button variant="ghost" size="sm" render={<Link to={item.to as never} />}>
                    {i18n.t(item.actionLabel)}
                  </Button>
                </li>
              );
            })}
          </ul>
          {items.length > SHOWN ? (
            <div className="overview-more">
              <Button variant="ghost" size="sm" onClick={() => setAll((v) => !v)}>
                {all
                  ? t("overview.attention.fewer")
                  : t("overview.attention.more", { count: items.length - SHOWN })}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="overview-clear">
          <EmptyState
            size="section"
            icon={CircleCheckIcon}
            title={t("overview.attention.clearTitle")}
            description={t("overview.attention.clearText")}
          />
        </div>
      )}
    </Panel>
  );
}
