import { useTranslation } from "react-i18next";

import type { Secret } from "@/modules/developer/api/secrets";
import { createdByMonth } from "@/modules/developer/machine-model";
import { Sparkline } from "@/modules/dashboard";
import { BandCount, BandLooks, BandSplit, useNumbers } from "../parts";
import {
  CHANGED,
  CHANGED_COLOR,
  changedOf,
  looksOf,
  NO_SCOPE,
  type SecretFilters,
} from "./secrets-model";

const MONTHS = 15;

/**
 * The vault's key numbers, in the header: how many secrets in how many scopes (added per month),
 * which scopes hold them, how long since each was changed, and what needs a look. Each opens the
 * list filtered to it.
 */
export function SecretsBand({ all, now }: { all: readonly Secret[]; now: number }) {
  const { t } = useTranslation("developer");
  const { n } = useNumbers();
  const scopeOf = (s: Secret) => s.scope.trim() || NO_SCOPE;
  const scopeLabel = (scope: string) => (scope === NO_SCOPE ? t("secrets.noScope") : scope);
  const scopes = [...new Set(all.map(scopeOf))];
  const scopeCounts = scopes
    .map((scope) => ({ scope, count: all.filter((s) => scopeOf(s) === scope).length }))
    .sort((a, b) => b.count - a.count);
  const topScopes = scopeCounts.slice(0, 4);
  const otherScopes = scopeCounts.slice(4).reduce((sum, s) => sum + s.count, 0);
  const to = (search: SecretFilters) => ({ to: "/auth/api/secrets", search });
  const months = createdByMonth(
    all.map((s) => s.created_at),
    now,
    MONTHS,
  );
  return (
    <dl className="ppl-band">
      <BandCount
        label={t("secrets.band.secrets")}
        value={n(all.length)}
        note={t("secrets.band.scopes", { count: scopes.length, n: n(scopes.length) })}
        chart={
          <>
            <span role="img" aria-label={t("secrets.band.growthLabel", { months: MONTHS })}>
              <Sparkline values={months} width={132} height={40} />
            </span>
            <span className="ppl-chart-caption" aria-hidden="true">
              {t("machine.band.months", { months: MONTHS })}
            </span>
          </>
        }
      />
      <BandSplit
        label={t("secrets.band.byScope")}
        parts={[
          ...topScopes.map((s, i) => ({
            id: s.scope,
            count: s.count,
            label: scopeLabel(s.scope),
            color: `var(--qx-color-dataviz-categorical-${i + 1})`,
            link: to({ scope: s.scope }),
          })),
          ...(otherScopes
            ? [
                {
                  id: "others",
                  count: otherScopes,
                  label: t("secrets.band.otherScopes"),
                  color: "var(--ppl-never)",
                },
              ]
            : []),
        ]}
      />
      <BandSplit
        label={t("secrets.band.changed")}
        parts={CHANGED.map((id) => ({
          id,
          count: all.filter((s) => changedOf(s, now) === id).length,
          label: t(`secrets.changed.${id}`),
          color: CHANGED_COLOR[id],
          link: to({ changed: id }),
        }))}
      />
      <BandLooks
        label={t("machine.band.needsALook")}
        looks={(["stale", "short"] as const).map((id) => ({
          id,
          label: t(`secrets.looks.${id}`),
          count: all.filter((s) => looksOf(s, now).includes(id)).length,
          link: to({ look: id }),
        }))}
      />
    </dl>
  );
}
