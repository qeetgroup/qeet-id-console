import { cn, Field, FieldLabel, Input } from "@qeetrix/ui";
import { InfoIcon, PaletteIcon, RotateCcwIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import {
  BRANDING_COLORS,
  brandingContrast,
  brandingForeground,
  normalizeBrandColor,
} from "../branding-model";
import { BrandingFieldError, type BrandingFields } from "./branding-settings-page-sections";

const PANEL =
  "min-w-0 rounded-lg border border-border/70 bg-card/90 p-3.5 shadow-xs dark:bg-card/70 dark:shadow-none";
const INPUT =
  "h-8 min-w-0 rounded-md bg-muted/15 text-xs pointer-coarse:min-h-11 pointer-coarse:text-base";
const ACCENTS = ["#f97316", "#ef4444", "#d946ef", "#8b5cf6", "#3b82f6", "#06b6d4", "#10b981"];
const BACKGROUNDS = ["#ffffff", "#f4f4f5", "#e4e4e7", "#a1a1aa", "#52525b", "#27272a", "#09090b"];

/** The three brand colours, each with a picker, a hex field and presets, plus a contrast check. */
export function BrandingColorsSection({ fields }: { fields: BrandingFields }) {
  const { t } = useTranslation("branding");
  const { id, draft, touched, errors } = fields;
  const primary = normalizeBrandColor(draft.primary_color) ?? BRANDING_COLORS.primary;
  const secondary = normalizeBrandColor(draft.secondary_color) ?? BRANDING_COLORS.secondary;
  const buttonContrast = brandingContrast(primary, brandingForeground(primary));
  const linkContrast = brandingContrast(primary, "#ffffff");

  return (
    <section className={PANEL} aria-labelledby={`${id}-colors`}>
      <h2
        id={`${id}-colors`}
        className="flex items-center gap-2 font-heading text-sm font-semibold"
      >
        <PaletteIcon className="size-4 text-info" aria-hidden="true" />
        {t("branding.workspace.colors.title")}
      </h2>
      <p className="mb-3 mt-1 text-[11px] leading-4 text-muted-foreground">
        {t("branding.workspace.colors.description")}
      </p>
      <div className="grid grid-cols-1 gap-4 @min-[650px]/branding:grid-cols-3">
        {(["primary_color", "secondary_color", "background_color"] as const).map((key) => {
          const color =
            normalizeBrandColor(draft[key]) ??
            (key === "background_color"
              ? "#ffffff"
              : BRANDING_COLORS[key === "primary_color" ? "primary" : "secondary"]);
          const label = t(`branding.workspace.fields.${key}`);
          return (
            <Field key={key}>
              <FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
              <p className="min-h-4 text-[10px] leading-4 text-muted-foreground">
                {t(`branding.workspace.colors.${key}`)}
              </p>
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="relative size-7 shrink-0 overflow-hidden rounded-full border border-border/70"
                  style={{ backgroundColor: color }}
                >
                  <input
                    type="color"
                    value={color}
                    aria-label={t("branding.workspace.colors.pick", { color: label })}
                    onChange={(event) => fields.onChange(key, event.target.value)}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                  />
                </span>
                <Input
                  id={`${id}-${key}`}
                  value={draft[key]}
                  placeholder={
                    key === "background_color" ? t("branding.workspace.colors.automatic") : color
                  }
                  onChange={(event) => fields.onChange(key, event.target.value)}
                  onBlur={() => fields.onTouch(key)}
                  aria-invalid={!!(touched[key] && errors[key])}
                  aria-describedby={touched[key] && errors[key] ? `${id}-${key}-error` : undefined}
                  className={cn(INPUT, "font-mono text-[11px]")}
                  maxLength={7}
                />
              </div>
              <div className="mt-1 flex min-h-5 flex-wrap items-center gap-1.5">
                {(key === "background_color" ? BACKGROUNDS : ACCENTS).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    aria-label={t("branding.workspace.colors.swatch", {
                      color: label,
                      hex: preset,
                    })}
                    aria-pressed={normalizeBrandColor(draft[key]) === preset}
                    onClick={() => fields.onChange(key, preset)}
                    className={cn(
                      "relative size-4 cursor-pointer rounded border border-border/50 outline-offset-2 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring pointer-coarse:size-8",
                      normalizeBrandColor(draft[key]) === preset &&
                        "ring-1 ring-foreground ring-offset-2 ring-offset-card",
                    )}
                    style={{ backgroundColor: preset }}
                  />
                ))}
                {key === "background_color" && (
                  <button
                    type="button"
                    title={t("branding.workspace.colors.resetBackground")}
                    aria-label={t("branding.workspace.colors.resetBackground")}
                    onClick={() => fields.onChange(key, "")}
                    className="grid size-5 cursor-pointer place-items-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:size-8"
                  >
                    <RotateCcwIcon className="size-3" />
                  </button>
                )}
              </div>
              <BrandingFieldError fields={fields} name={key} />
            </Field>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/50 bg-muted/20 px-3 py-2.5">
        <div className="flex items-start gap-2">
          <PaletteIcon className="mt-0.5 size-3.5 shrink-0 text-info" aria-hidden="true" />
          <div>
            <p className="text-[11px] font-medium">{t("branding.workspace.colors.preview")}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {t("branding.workspace.colors.contrast", { ratio: buttonContrast.toFixed(1) })}
            </p>
          </div>
        </div>
        <div aria-hidden="true" className="flex flex-wrap items-center gap-2">
          <span
            className="rounded px-3 py-1.5 text-[10px] font-medium"
            style={{ backgroundColor: primary, color: brandingForeground(primary) }}
          >
            {t("branding.workspace.colors.primaryButton")}
          </span>
          <span
            className="rounded px-3 py-1.5 text-[10px] font-medium"
            style={{ backgroundColor: secondary, color: brandingForeground(secondary) }}
          >
            {t("branding.workspace.colors.secondaryButton")}
          </span>
        </div>
      </div>
      {linkContrast < 4.5 && (
        <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-4 text-warning">
          <InfoIcon className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
          {t("branding.workspace.colors.linkWarning", { ratio: linkContrast.toFixed(1) })}
        </p>
      )}
    </section>
  );
}
