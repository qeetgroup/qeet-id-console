import { Avatar, AvatarFallback, AvatarImage, cn } from "@qeetrix/ui";
import { CheckIcon, CrownIcon, GlobeIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import type { EligibleOrganization } from "@/platform/auth/organization-selection";
import { organizationImage, organizationInitials } from "../organization-selection-model";
import type { OrganizationLayout } from "./organization-selector-toolbar";

const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-rose-600",
  "bg-emerald-600",
  "bg-orange-600",
  "bg-violet-600",
  "bg-cyan-700",
];

/** Renders one organization as a radio card: logo, name, domain, region, plan and roles. */
export function OrganizationSelectorCard({
  organization,
  group,
  chosen,
  lastUsed,
  layout,
  roleLabel,
  planLabel,
  onSelect,
}: {
  organization: EligibleOrganization;
  /** The view's useId(), prefixing the radio's id and its group's name. */
  group: string;
  chosen: boolean;
  lastUsed: boolean;
  layout: OrganizationLayout;
  roleLabel: (name: string) => string;
  planLabel: (plan: string) => string;
  onSelect: () => void;
}) {
  const { t, i18n } = useTranslation("auth-flow");
  const inputId = `${group}-${organization.id}`;
  const color =
    AVATAR_COLORS[
      organization.id.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0) %
        AVATAR_COLORS.length
    ];
  return (
    <div className="relative min-w-0">
      <input
        type="radio"
        id={inputId}
        name={`${group}-organization`}
        aria-label={organization.name}
        value={organization.id}
        checked={chosen}
        onChange={onSelect}
        className="peer sr-only"
      />
      <label
        htmlFor={inputId}
        data-organization-id={organization.id}
        className={cn(
          "relative flex h-full min-w-0 cursor-pointer gap-3.5 rounded-lg border px-4 py-4 shadow-xs transition-colors motion-reduce:transition-none peer-focus-visible:outline-2 peer-focus-visible:outline-solid peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring peer-disabled:cursor-wait peer-disabled:opacity-65",
          layout === "grid" ? "min-h-29" : "min-h-24 items-center",
          chosen
            ? "border-primary/80 bg-primary/4 dark:bg-primary/7"
            : "border-border/70 bg-card/80 hover:border-primary/40 hover:bg-card dark:bg-card/60 dark:hover:bg-card/90",
        )}
      >
        <Avatar className="mt-0.5 size-11 shrink-0 rounded-lg">
          <AvatarImage
            src={organizationImage(organization.logo_url)}
            alt=""
            referrerPolicy="no-referrer"
            className="object-contain"
          />
          <AvatarFallback
            className={cn("rounded-lg font-heading text-base font-semibold text-white", color)}
          >
            {organizationInitials(organization.name)}
          </AvatarFallback>
        </Avatar>
        <div
          className={cn(
            "min-w-0 flex-1 pe-6",
            layout === "list" && "sm:flex sm:items-center sm:justify-between sm:gap-4",
          )}
        >
          <div className={cn("min-w-0", layout === "list" && "sm:flex-1")}>
            <p
              className={cn(
                "font-heading text-sm font-semibold leading-5 wrap-break-word",
                lastUsed && layout === "grid" && "pe-12",
              )}
            >
              {organization.name}
            </p>
            <p
              className="mt-0.5 truncate text-xs text-muted-foreground"
              title={organization.domain || organization.slug}
            >
              {organization.domain || organization.slug}
            </p>
          </div>
          <div
            className={cn(
              "mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground",
              layout === "list" && "sm:mt-0 sm:flex-1",
            )}
          >
            <span
              className="inline-flex min-w-0 items-center gap-1"
              title={t("organizationSelection.region")}
            >
              <GlobeIcon className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {organization.region || t("organizationSelection.notReported")}
              </span>
            </span>
            <span aria-hidden="true">&middot;</span>
            <span
              className="inline-flex items-center gap-1"
              title={t("organizationSelection.plan")}
            >
              <CrownIcon className="size-3 shrink-0" aria-hidden="true" />
              {planLabel(organization.plan)}
            </span>
          </div>
          <div
            className={cn(
              "mt-2 flex min-w-0 flex-wrap gap-1",
              layout === "list" && "sm:mt-0 sm:max-w-40 sm:justify-end",
            )}
          >
            {organization.roles.map((name) => (
              <span
                key={name}
                title={roleLabel(name)}
                className={cn(
                  "max-w-full truncate rounded px-2 py-0.5 text-[10px] font-medium",
                  name.toLowerCase() === "owner"
                    ? "bg-success/10 text-success"
                    : name.toLowerCase() === "admin"
                      ? "bg-info/10 text-info"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {roleLabel(name)}
              </span>
            ))}
          </div>
        </div>
        {lastUsed && (
          <span
            className={cn(
              "absolute inset-e-3 top-2 rounded-full bg-primary/12 px-2 py-0.5 text-[9px] font-medium text-primary",
              layout === "list" && "inset-e-10",
            )}
            title={
              organization.last_used_at
                ? new Date(organization.last_used_at).toLocaleString(i18n.language)
                : undefined
            }
          >
            {t("organizationSelection.lastUsed")}
          </span>
        )}
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-e-4 top-1/2 grid size-4.5 -translate-y-1/2 place-items-center rounded-full border",
            chosen
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/45 bg-background/30",
          )}
        >
          {chosen && <CheckIcon className="size-3" strokeWidth={3} />}
        </span>
      </label>
    </div>
  );
}
