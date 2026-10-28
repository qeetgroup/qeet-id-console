// What a run found missing: each failing check (then each without evidence), what was found, how
// long it has been so (from the runs before it), and the console page that changes its setting.

import { ArrowRightIcon, CircleAlertIcon, CircleDashedIcon } from "@qeetrix/icons";
import { Badge, Button, formatDate, formatNumber } from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { ControlResult, ControlStatus, EvidenceRun } from "@/modules/compliance/api/evidence";
import {
  fixFor,
  fixPlaces,
  missingOf,
  statusIn,
  streakOf,
} from "@/modules/compliance/evidence-model";
import { useCapabilities } from "@/platform/security/capability-provider";
import { getRequiredCapabilityForPath } from "@/platform/security/route-capability";
import { Code, ControlBadge, Item, Section } from "../compliance-parts";

type Missing = Exclude<ControlStatus, "pass">;

export function MissingSection({
  run,
  history,
  total,
  latest,
  latestRun,
}: {
  run: EvidenceRun;
  /** This run and the ones before it, newest first, as far as they were read. */
  history: readonly (EvidenceRun | undefined)[];
  /** Runs on record from this one back. */
  total: number;
  latest: boolean;
  latestRun?: EvidenceRun;
}) {
  const { t } = useTranslation("compliance");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const controls = run.controls ?? [];
  const missing = missingOf(controls);
  if (!missing.length) return null;
  const failing = missing.filter((c) => c.status === "fail").length;
  const noEvidence = missing.length - failing;
  const parts = [
    failing
      ? t("evidence.missing.failingIn", {
          failing: t("evidence.missing.failing", { count: failing, n: n(failing) }),
          places: t("evidence.missing.places", {
            count: fixPlaces(controls),
            n: n(fixPlaces(controls)),
          }),
        })
      : null,
    noEvidence ? t("evidence.missing.noEvidence", { count: noEvidence, n: n(noEvidence) }) : null,
  ].filter(Boolean);

  return (
    <Section
      title={latest ? t("evidence.missing.title") : t("evidence.missing.titleOlder")}
      status={
        <Badge tone="danger" size="sm">
          {n(missing.length)}
        </Badge>
      }
      description={t("evidence.missing.summary", { parts: parts.join("; ") })}
    >
      <ul className="account-rows">
        {missing.map((c) => (
          <MissingItem
            key={c.id}
            control={c}
            since={
              latest
                ? sinceLine(c, history, total)
                : nowLine(c.status as Missing, statusIn(latestRun, c.id), latestRun)
            }
          />
        ))}
      </ul>
    </Section>
  );

  function sinceLine(
    c: ControlResult,
    runs: readonly (EvidenceRun | undefined)[],
    count: number,
  ): string | null {
    const streak = streakOf(runs, c.id, count);
    const status = c.status as Missing;
    if (!streak) return null;
    const date = formatDate(streak.since, locale);
    if (streak.runs === 1) {
      if (!streak.before) return null; // the first run on record says nothing about before
      return t(`evidence.since.${status}.new`, {
        before: t(`evidence.since.before.${streak.before}`),
      });
    }
    const shape = streak.everyRun ? "every" : streak.capped ? "capped" : "since";
    return t(`evidence.since.${status}.${shape}`, { date, count: streak.runs, n: n(streak.runs) });
  }

  function nowLine(
    status: Missing,
    now: ControlStatus | undefined,
    newest: EvidenceRun | undefined,
  ): string | null {
    if (!now || !newest) return null;
    const date = formatDate(newest.generated_at, locale);
    if (now === status) return t(`evidence.latest.still.${status}`, { date });
    return t(`evidence.latest.now.${now}`, { date });
  }
}

function MissingItem({ control: c, since }: { control: ControlResult; since: string | null }) {
  const { t } = useTranslation("compliance");
  const access = useCapabilities();
  const fix = fixFor(c.id);
  const need = fix ? getRequiredCapabilityForPath(fix.to) : undefined;
  const canOpen = !!fix && (!need || access.can(need));
  return (
    <Item
      icon={c.status === "fail" ? <CircleAlertIcon /> : <CircleDashedIcon />}
      name={c.name}
      badge={<ControlBadge status={c.status} />}
      line={
        <>
          <Code>{c.criteria}</Code> · {c.detail}
          {since ? <span className="cmp-since">{since}</span> : null}
        </>
      }
      actions={
        fix && canOpen ? (
          <Button
            variant="ghost"
            icon={ArrowRightIcon}
            render={<Link to={fix.to as never} />}
            aria-label={t("evidence.fix.open", {
              place: t(`evidence.fix.${fix.place}`),
              name: c.name,
            })}
          >
            {t(`evidence.fix.${fix.place}`)}
          </Button>
        ) : undefined
      }
    />
  );
}
