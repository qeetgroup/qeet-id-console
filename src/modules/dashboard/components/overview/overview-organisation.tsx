// The organisation's shape, the one thing the Dashboard took from the Directory overview: its
// departments and their teams as a squarified treemap (each department opens the Users list
// filtered to it), and where people work as circles sized by people, a row per country. Both come
// from what each person's profile says. Until QTRX-24: the library has no treemap or proportional
// circles, so both are drawn here.

import { VisuallyHidden } from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import {
  type OrgDepartment,
  type orgShape,
  type placesByCountry,
  type Rect,
  squarify,
} from "@/modules/dashboard/overview-directory-model";
import { num, Panel, pct } from "./overview-parts";

// The map's own units; it draws at its panel's width, about two-thirds of that.
const W = 1000;
const H = 330;

const box = (r: Rect, w: number, h: number) => ({
  left: `${(r.x / w) * 100}%`,
  top: `${(r.y / h) * 100}%`,
  width: `${(r.w / w) * 100}%`,
  height: `${(r.h / h) * 100}%`,
});

/** A department's teams, squarified inside what's left of its tile under the header. */
function Teams({ teams, w, h }: { teams: OrgDepartment["teams"]; w: number; h: number }) {
  const { t } = useTranslation("dashboard");
  const rects = squarify(
    teams.map((team) => team.count),
    { x: 0, y: 0, w, h },
  );
  return (
    <span className="overview-org-teams" aria-hidden="true">
      {teams.map((team, i) => {
        const r = rects[i] as Rect;
        const name = team.team ?? t("overview.organisation.noTeam");
        return (
          <span
            key={team.team ?? ""}
            className={team.team ? "overview-org-team" : "overview-org-team is-none"}
            style={box(r, w, h)}
            title={`${name}: ${num(team.count)}`}
          >
            {r.w > 110 && r.h > 56 ? <span className="overview-org-team-name">{name}</span> : null}
            {r.w > 34 && r.h > 34 ? (
              <b className="overview-org-team-count">{num(team.count)}</b>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

export function OrgMapPanel({
  shape,
  orgName,
}: {
  shape: ReturnType<typeof orgShape>;
  orgName?: string;
}) {
  const { t } = useTranslation("dashboard");
  const { departments } = shape;
  const rects = squarify(
    departments.map((d) => d.count),
    { x: 0, y: 0, w: W, h: H },
  );
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
      <ul className="overview-org-map" aria-label={t("overview.organisation.mapLabel")}>
        {departments.map((d, i) => {
          const r = rects[i] as Rect;
          const name = d.name ?? t("overview.organisation.noDepartment");
          const hasTeams = d.teams.some((team) => team.team);
          const label = t(
            hasTeams ? "overview.organisation.tileTeams" : "overview.organisation.tile",
            {
              name,
              count: d.count,
              teams: d.teams
                .map((team) =>
                  t("overview.organisation.teamCount", {
                    team: team.team ?? t("overview.organisation.noTeam"),
                    count: num(team.count),
                  }),
                )
                .join(", "),
            },
          );
          // The header is the link's whole visible text, so its name starts with what's seen
          // (WCAG 2.5.3); the link stretches over the tile, and the teams are drawn under it.
          const head = (
            <>
              <b className="overview-org-dept-name">{name}</b> <span>{num(d.count)}</span>
            </>
          );
          return (
            <li
              key={d.name ?? ""}
              className={d.name ? "overview-org-cell" : "overview-org-cell is-none"}
              style={box(r, W, H)}
              title={`${name}: ${num(d.count)}`}
            >
              {d.name ? (
                <Link
                  to="/users"
                  search={{ dept: d.name }}
                  className="overview-org-dept"
                  aria-label={label}
                >
                  {head}
                </Link>
              ) : (
                <>
                  <span className="overview-org-dept" aria-hidden="true">
                    {head}
                  </span>
                  <VisuallyHidden>{label}</VisuallyHidden>
                </>
              )}
              {r.w > 90 && r.h > 70 ? <Teams teams={d.teams} w={r.w - 8} h={r.h - 30} /> : null}
            </li>
          );
        })}
      </ul>
      {foot.length ? <p className="overview-org-foot">{foot.join(" · ")}</p> : null}
    </Panel>
  );
}

const R = 40; // the biggest city's radius

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
  const max = Math.max(1, ...cities.map((c) => c.count));
  const radius = (v: number) => Math.max(5, R * Math.sqrt(v / max));
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
        {places.map((place, gi) => (
          <figure key={place.country} className="overview-places-country">
            <figcaption className="overview-places-caption">
              <b className="overview-places-name">{countryName(place.country)}</b>
              <span>{t("overview.organisation.people", { count: place.count })}</span>
            </figcaption>
            <ul className="overview-places-cities">
              {place.cities.map((c) => {
                const r = radius(c.count);
                return (
                  <li
                    key={c.city}
                    className="overview-places-city"
                    title={`${c.city}: ${num(c.count)}`}
                  >
                    <svg
                      width={r * 2}
                      height={r * 2}
                      viewBox={`0 0 ${r * 2} ${r * 2}`}
                      aria-hidden="true"
                    >
                      <circle
                        cx={r}
                        cy={r}
                        r={r - 1}
                        className={
                          gi === 0 ? "overview-places-dot" : "overview-places-dot is-other"
                        }
                      />
                      {c.count >= 5 ? (
                        <text
                          x={r}
                          y={r + 5}
                          textAnchor="middle"
                          className="overview-places-dot-count"
                        >
                          {num(c.count)}
                        </text>
                      ) : null}
                    </svg>
                    <small className="overview-places-label" aria-hidden="true">
                      {c.count < 5 ? `${c.city} · ${num(c.count)}` : c.city}
                    </small>
                    <VisuallyHidden>
                      {t("overview.organisation.cityPeople", { city: c.city, count: c.count })}
                    </VisuallyHidden>
                  </li>
                );
              })}
            </ul>
          </figure>
        ))}
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
