import { cn, Tooltip, TooltipContent, TooltipTrigger } from "@qeetrix/ui";
import { QeetLogoOnLight } from "@qeetrix/ui/brand";
import {
  EyeIcon,
  GlobeIcon,
  InfoIcon,
  LayersIcon,
  MailIcon,
  MonitorIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  BRANDING_COLORS,
  type BrandingDraft,
  brandingForeground,
  normalizeBrandColor,
  validBrandDomain,
  validBrandLogo,
} from "../branding-model";

const PANEL =
  "min-w-0 rounded-lg border border-border/70 bg-card/90 p-3.5 shadow-xs dark:bg-card/70 dark:shadow-none";

export function BrandingPreview({
  draft,
  logoReady,
}: {
  draft: BrandingDraft;
  logoReady: boolean;
}) {
  const { t } = useTranslation("settings");
  const [mode, setMode] = useState<"desktop" | "mobile">("desktop");
  const primary = normalizeBrandColor(draft.primary_color) ?? BRANDING_COLORS.primary;
  const accent = normalizeBrandColor(draft.secondary_color) ?? BRANDING_COLORS.secondary;
  const background = normalizeBrandColor(draft.background_color);
  const logo = logoReady && validBrandLogo(draft.logo_url) ? draft.logo_url.trim() : "";
  const domain =
    draft.custom_domain.trim() && validBrandDomain(draft.custom_domain)
      ? draft.custom_domain.trim().toLowerCase()
      : "login.id.qeet.in";

  return (
    <aside aria-label={t("branding.workspace.preview.sidebar")} className="min-w-0 space-y-4">
      <section className={PANEL} aria-labelledby="branding-preview-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="branding-preview-title"
            className="flex items-center gap-2 font-heading text-sm font-semibold"
          >
            <EyeIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            {t("branding.workspace.preview.title")}
          </h2>
          <fieldset
            aria-label={t("branding.workspace.preview.size")}
            className="inline-flex rounded-md border border-border/70 bg-muted/30 p-0.5"
          >
            {(["desktop", "mobile"] as const).map((value) => {
              const Icon = value === "desktop" ? MonitorIcon : SmartphoneIcon;
              return (
                <Tooltip key={value}>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label={t(`branding.workspace.preview.${value}`)}
                        aria-pressed={mode === value}
                        onClick={() => setMode(value)}
                        className={cn(
                          "grid size-7 cursor-pointer place-items-center rounded focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring pointer-coarse:size-11",
                          mode === value
                            ? "bg-card text-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      />
                    }
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent>{t(`branding.workspace.preview.${value}`)}</TooltipContent>
                </Tooltip>
              );
            })}
          </fieldset>
        </div>
        <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
          {t("branding.workspace.preview.description")}
        </p>
        <figure className="mt-3 overflow-hidden rounded-md border border-border/70">
          <div className="flex h-7 items-center gap-2 border-b border-border/60 bg-muted/35 px-2.5">
            <span className="flex gap-1" aria-hidden="true">
              <span className="size-1.5 rounded-full bg-red-400" />
              <span className="size-1.5 rounded-full bg-amber-400" />
              <span className="size-1.5 rounded-full bg-emerald-400" />
            </span>
            <GlobeIcon className="ms-1 size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 truncate text-[9px] text-muted-foreground">{domain}</span>
          </div>
          <div
            data-preview-mode={mode}
            className="relative flex min-h-60 items-center justify-center overflow-hidden bg-muted/15 px-4 py-4"
            style={background ? { backgroundColor: background } : undefined}
          >
            <div
              aria-hidden="true"
              className="absolute inset-y-0 start-0 w-1"
              style={{ backgroundColor: accent }}
            />
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none relative w-full rounded-lg border border-zinc-200 bg-white px-4 py-4 text-zinc-900 shadow-sm",
                mode === "mobile" ? "max-w-45" : "max-w-55",
              )}
            >
              <div className="mb-4 flex min-h-8 items-center justify-center gap-2">
                {logo ? (
                  <img
                    src={logo}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-8 w-auto max-w-full object-contain"
                  />
                ) : (
                  <>
                    <QeetLogoOnLight size={27} title={null} />
                    <span className="font-heading text-sm font-semibold">Qeet ID</span>
                  </>
                )}
              </div>
              <h3 className="text-center text-[11px] font-semibold leading-4">
                {t("branding.workspace.preview.signIn")}
              </h3>
              <p className="mt-1 text-center text-[9px] text-zinc-500">
                {t("branding.workspace.preview.emailHint")}
              </p>
              <div className="mt-3 flex h-7 items-center gap-1.5 rounded border border-zinc-200 px-2 text-[9px] text-zinc-500">
                <MailIcon className="size-3 shrink-0" />
                you@example.com
              </div>
              <div
                data-preview-primary
                className="mt-2 flex h-7 items-center justify-center rounded text-[10px] font-medium"
                style={{ backgroundColor: primary, color: brandingForeground(primary) }}
              >
                {t("branding.preview.continue")}
              </div>
              <div className="mt-4 border-t border-zinc-100 pt-3 text-center text-[8px] text-zinc-500">
                {t("branding.preview.securedBy")}{" "}
                <span className="font-medium text-zinc-700">Qeet ID</span>
              </div>
            </div>
          </div>
          <figcaption className="sr-only">{t("branding.workspace.preview.caption")}</figcaption>
        </figure>
        <p className="mt-2.5 flex items-start gap-2 rounded-md border border-info/15 bg-info/5 px-2.5 py-2 text-[10px] leading-4 text-info">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {t("branding.workspace.preview.note")}
        </p>
      </section>
      <section className={PANEL}>
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold">
          <LayersIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          {t("branding.workspace.appears.title")}
        </h2>
        <ul className="mt-3 space-y-2.5">
          {(["login", "email", "domain", "security"] as const).map((area) => {
            const Icon = {
              login: EyeIcon,
              email: MailIcon,
              domain: GlobeIcon,
              security: ShieldCheckIcon,
            }[area];
            return (
              <li key={area} className="flex items-start gap-2.5">
                <Icon
                  className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-xs font-medium">
                    {t(`branding.workspace.appears.${area}.title`)}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                    {t(`branding.workspace.appears.${area}.description`)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}
