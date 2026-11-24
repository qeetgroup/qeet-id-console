// The organisation's shape, the one thing the Dashboard took from the Directory overview: its
// departments and their teams as a treemap (each department opens the Users list filtered to it),
// and where people work as circles sized by people, a row per country (Qeetrix's Treemap and
// ProportionalCircles). Both come from what each person's profile says.

import { ProportionalCircles, Treemap } from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { orgShape, placesByCountry } from "@/modules/dashboard/overview-directory-model";
import { Panel, pct } from "./overview-parts";

// The map's shape: wide, about a third as tall as it is wide.
const ASPECT = 1000 / 330;
const NONE = "\u0000none"; // the id of "No department" / "No team", which no name can be

export function OrgMapPanel({
  shape,
  orgName,
}: {
  shape: ReturnType<typeof orgShape>;
  orgName?: string;
}) {
  const { t } = useTranslation("dashboard");
  const { departments } = shape;
  const foot = [
    shape.noTeam ? t("overview.organisation.noTeamFoot", { count: shape.noTeam }) : null,
    shape.noDepartment
      ? t("overview.organisation.noDepartmentFoot", { count: shape.noDepartment })
      : null,
  ].filter(Boolean);
  return (
    <Panel
      title={
        orgName
          ? t("overview.organisation.mapTitle", { name: orgName })
          : t("overview.organisation.mapTitleYours")
      }
      note={t("overview.organisation.mapNote", { count: shape.named })}
    >
      <Treemap
        aria-label={t("overview.organisation.mapLabel")}
        aspectRatio={ASPECT}
        locale={formatLocale()}
        nodes={departments.map((d) => ({
          id: d.name ?? NONE,
          label: d.name ?? t("overview.organisation.noDepartment"),
          value: d.count,
          tone: d.name ? "data" : "none",
          render: d.name ? <Link to="/users" search={{ dept: d.name }} /> : undefined,
          children: d.teams.map((team) => ({
            id: team.team ?? NONE,
            label: team.team ?? t("overview.organisation.noTeam"),
            value: team.count,
            tone: team.team ? "data" : "none",
          })),
        }))}
      />
      {foot.length ? <p className="overview-org-foot">{foot.join(" · ")}</p> : null}
    </Panel>
  );
}

export function PlacesPanel({
  places,
  people,
}: {
  places: ReturnType<typeof placesByCountry>;
  people: number;
}) {
  const { t } = useTranslation("dashboard");
  const regions = new Intl.DisplayNames([formatLocale()], { type: "region" });
  const countryName = (code: string) => {
    if (!code) return t("overview.organisation.elsewhere");
    try {
      return regions.of(code.toUpperCase()) ?? code;
    } catch {
      return code; // not a region code: shown as the profile has it
    }
  };
  const cities = places.flatMap((p) => p.cities);
  const top = places[0]?.cities[0];
  const only = places.length === 1 ? places[0] : undefined;
  return (
    <Panel
      title={t("overview.organisation.placesTitle")}
      note={
        only
          ? t("overview.organisation.placesNoteOneCountry", {
              count: cities.length,
              country: countryName(only.country),
            })
          : t("overview.organisation.placesNote", {
              count: cities.length,
              countries: places.length,
            })
      }
    >
      <div className="overview-places">
        <ProportionalCircles
          locale={formatLocale()}
          groups={places.map((place, gi) => ({
            id: place.country || NONE,
            label: countryName(place.country),
            meta: t("overview.organisation.people", { count: place.count }),
            tone: gi === 0 ? "data" : "reference",
            items: place.cities.map((c) => ({ id: c.city, label: c.city, value: c.count })),
          }))}
        />
        {top && people ? (
          <p className="overview-places-foot">
            {t("overview.organisation.cityShare", {
              share: pct(Math.round((top.count / people) * 100)),
              city: top.city,
            })}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
