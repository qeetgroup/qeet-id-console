// The organisation's set-up as a checklist: "6 of 12 done" over a bar with one segment per item
// (sorted by state, so it reads as progress), then the items in three ruled panels. Each item says
// its state in a word beside its icon — each state has its own icon shape, never colour alone —
// and only the ones that need something carry an action, so what's done stays quiet.

import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotDashedIcon,
} from "@qeetrix/icons";
import type { QeetrixIcon } from "@qeetrix/react";
import { Button } from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import i18n from "@/i18n";
import {
  SETUP_ORDER,
  type SetupGroup,
  type SetupState,
} from "@/modules/dashboard/overview-setup-model";

const STATE: Record<SetupState, { icon: QeetrixIcon; mark: string }> = {
  done: { icon: CircleCheckIcon, mark: "var(--qx-color-icon-success)" },
  failing: { icon: CircleAlertIcon, mark: "var(--qx-color-icon-danger)" },
  attention: { icon: CircleAlertIcon, mark: "var(--qx-color-icon-warning)" },
  setup: { icon: CircleDotDashedIcon, mark: "var(--qx-color-icon-info)" },
  none: { icon: CircleDashedIcon, mark: "var(--qx-color-border-strong)" },
};

export function SetupPanel({ groups }: { groups: SetupGroup[] }) {
  const { t } = useTranslation("dashboard");
  const all = groups.flatMap((g) => g.items);
  const count = (state: SetupState) => all.filter((i) => i.state === state).length;
  const summary = SETUP_ORDER.map((state) => ({ state, n: count(state) })).filter((s) => s.n > 0);
  const bar = [...all].sort((a, b) => SETUP_ORDER.indexOf(a.state) - SETUP_ORDER.indexOf(b.state));
  return (
    <div
      className="overview-sheet overview-setup"
      style={{ "--overview-columns": `repeat(${groups.length}, minmax(0, 1fr))` } as CSSProperties}
    >
      <header className="overview-setup-head">
        <div>
          <h3 className="overview-panel-title">
            {t("overview.setup.progress", { done: count("done"), total: all.length })}
          </h3>
          <p className="overview-panel-note">{t("overview.setup.note")}</p>
        </div>
        <div className="overview-setup-progress">
          <div
            className="overview-setup-bar"
            role="img"
            aria-label={summary
              .map((s) => t(`overview.setup.summary.${s.state}`, { count: s.n }))
              .join(", ")}
          >
            {bar.map((item) => (
              <span
                key={item.id}
                className={`is-${item.state}`}
                title={`${i18n.t(item.name)}: ${t(`overview.setup.states.${item.state}`)}`}
              />
            ))}
          </div>
          <ul className="overview-setup-legend">
            {summary.map((s) => (
              <li key={s.state}>
                <span className={`overview-swatch is-${s.state}`} aria-hidden="true" />
                {t(`overview.setup.summary.${s.state}`, { count: s.n })}
              </li>
            ))}
          </ul>
        </div>
      </header>
      {groups.map((group) => (
        <section key={group.id} className="overview-panel overview-setup-group">
          <h4 className="overview-setup-title">{t(`overview.setup.groups.${group.id}`)}</h4>
          <ul className="overview-setup-items">
            {group.items.map((item) => {
              const state = STATE[item.state];
              const Icon = state.icon;
              return (
                <li key={item.id} className={`overview-setup-item is-${item.state}`}>
                  <Icon aria-hidden="true" style={{ color: state.mark }} />
                  <span className="overview-setup-text">
                    <strong>{i18n.t(item.name)}</strong>
                    <small>
                      <span className="overview-setup-word">
                        {t(`overview.setup.states.${item.state}`)}
                      </span>
                      {i18n.t(item.detail.key, item.detail.params)}
                    </small>
                  </span>
                  {item.action ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      render={<Link to={item.action.to as never} />}
                    >
                      {i18n.t(item.action.label)}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
