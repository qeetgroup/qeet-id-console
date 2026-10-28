import { Badge, formatDate, Link } from "@qeetrix/react";
import { CopyButton } from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { OrgRow } from "@/modules/organizations/orgs-model";
import { OrgSection } from "./org-section";

// Qeet ID's data regions (src/shared/data/regions.ts) and where each is, for the ruler: their
// city, their area, and the longitude that places them.
const PLACES = {
  "us-east-1": { city: "page.regionCity.usEast1", area: "page.regionArea.usEast1", lon: -77 },
  "eu-west-1": { city: "page.regionCity.euWest1", area: "page.regionArea.euWest1", lon: -8 },
  "ap-south-1": { city: "page.regionCity.apSouth1", area: "page.regionArea.apSouth1", lon: 73 },
} as const;
type PlaceId = keyof typeof PLACES;
const placeOf = (region: string) => (region in PLACES ? PLACES[region as PlaceId] : undefined);

/** Qeet ID's data regions on a ruler of longitude, 120°W to 120°E; the organisation's in Ember. */
function RegionRuler({ region }: { region: string }) {
  const { t } = useTranslation("organizations");
  const W = 340;
  const x = (lon: number) => 14 + ((lon + 120) / 240) * (W - 28);
  const name = (id: string) => {
    const place = placeOf(id);
    return place ? `${t(place.area)} (${t(place.city)})` : id;
  };
  return (
    <svg
      className="org-ruler"
      viewBox={`0 0 ${W} 58`}
      role="img"
      aria-label={t("page.identity.rulerLabel", {
        region: name(region),
        all: Object.keys(PLACES).map(name).join(", "),
      })}
    >
      <title>{t("page.identity.rulerTitle", { region: name(region) })}</title>
      <line x1={x(-120)} x2={x(120)} y1={22} y2={22} className="org-ruler-line" />
      {[-120, -90, -60, -30, 0, 30, 60, 90, 120].map((lon) => (
        <line
          key={lon}
          x1={x(lon)}
          x2={x(lon)}
          y1={lon === 0 ? 14 : 18}
          y2={lon === 0 ? 30 : 26}
          className="org-ruler-tick"
        />
      ))}
      {Object.entries(PLACES).map(([id, place]) => {
        const here = id === region;
        const size = here ? 12 : 8;
        return (
          <g key={id}>
            <rect
              x={x(place.lon) - size / 2}
              y={22 - size / 2}
              width={size}
              height={size}
              className={here ? "org-ruler-here" : "org-ruler-other"}
            />
            <text
              x={x(place.lon)}
              y={50}
              textAnchor="middle"
              className={here ? "org-ruler-label is-here" : "org-ruler-label"}
            >
              {t(place.city)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Identity: three ruled panels, each one fact only an organisation has. Its address (the URL that
 * can't change, and its ID); its domain and what verifying it means (the server: the organisation
 * that verified a domain manages the accounts on it, and no other can create them); and its data
 * region, on a ruler of Qeet ID's regions. `verifiedAt` is the domain's verification, when it can be
 * read (the organisation you're in, with connection.read).
 */
export function IdentitySection({
  org,
  current,
  verifiedAt,
  canEdit,
}: {
  org: OrgRow;
  current: boolean;
  verifiedAt?: string | null;
  canEdit: boolean;
}) {
  const { t } = useTranslation("organizations");
  const locale = formatLocale();
  const place = placeOf(org.region);
  return (
    <OrgSection
      id="org-identity"
      title={t("page.identity.heading")}
      action={
        current && canEdit ? (
          <Link
            className="org-page-link"
            render={<RouterLink to="/settings/organization/general" />}
          >
            {t("page.identity.change")}
          </Link>
        ) : undefined
      }
    >
      <div className="org-id">
        <div className="org-id-cell">
          <p className="org-id-cap">{t("page.identity.address")}</p>
          <p className="org-id-value">
            <code>{org.slug}</code>
          </p>
          <p className="org-id-note">{t("page.identity.addressNote")}</p>
          <p className="org-id-meta">
            <span className="org-id-meta-term">{t("page.identity.id")}</span>
            <code>{org.id}</code>
            <CopyButton value={org.id} label={t("page.identity.copyId")} size="sm" />
          </p>
          {current ? null : (
            <p className="org-id-note">
              {t("page.identity.created", {
                date: formatDate(org.created_at, locale, { dateStyle: "long" }),
              })}
            </p>
          )}
        </div>

        <div className="org-id-cell">
          <p className="org-id-cap">{t("page.identity.domain")}</p>
          {org.domain ? (
            <>
              <p className="org-id-value">
                {org.domain}
                <Badge tone="success" size="sm">
                  {t("page.identity.verified")}
                </Badge>
              </p>
              <p className="org-id-note">
                {t("page.identity.domainNote", { name: org.name, domain: org.domain })}
              </p>
              <p className="org-id-meta">
                {verifiedAt
                  ? t("page.identity.verifiedOn", {
                      date: formatDate(verifiedAt, locale, { dateStyle: "long" }),
                    })
                  : t("page.identity.verifiedBy")}
                {current ? (
                  <>
                    {" · "}
                    <Link render={<RouterLink to="/settings/organization/domains" />}>
                      {t("page.identity.domains")}
                    </Link>
                  </>
                ) : null}
              </p>
            </>
          ) : (
            <>
              <p className="org-id-value is-none">{t("page.identity.noDomain")}</p>
              <p className="org-id-note">{t("page.identity.noDomainNote")}</p>
              {current && canEdit ? (
                <p className="org-id-meta">
                  <Link render={<RouterLink to="/settings/organization/domains" />}>
                    {t("page.identity.addDomain")}
                  </Link>
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="org-id-cell">
          <p className="org-id-cap">{t("page.identity.region")}</p>
          <p className="org-id-value">{place ? t(place.city) : org.region || "—"}</p>
          <p className="org-id-note">
            {place
              ? t("page.identity.regionNote", { area: t(place.area) })
              : t("page.identity.regionNoteUnknown")}
          </p>
          {org.region ? <RegionRuler region={org.region} /> : null}
        </div>
      </div>
    </OrgSection>
  );
}
