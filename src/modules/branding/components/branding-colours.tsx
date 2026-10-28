import { Button, Input, Text } from "@qeetrix/react";
import { Alert } from "@qeetrix/react/experimental";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  type BrandingChange,
  brandingContrast,
  brandingForeground,
  normalizeBrandColor,
} from "../branding-model";
import { Detail, EditingDetail, Section } from "./branding-parts";

// Suggested colours beside each field. They're tenant brand colours (domain data, saved as the
// organisation's own), so raw hex is right here: the brand ones are the console's old presets,
// the backgrounds light enough for the sign-in card to sit on.
const BRAND_PRESETS = ["#f97316", "#ef4444", "#d946ef", "#8b5cf6", "#3b82f6", "#06b6d4", "#10b981"];
const BACKGROUND_PRESETS = ["#ffffff", "#fafaf9", "#fff8f2", "#f5f5f4", "#eff6ff", "#f0fdf4"];
// The white a sign-in link sits on (the card), for the contrast it reaches.
const CARD = "#ffffff";

type ColourKey = "brand" | "background";

export type BrandingColoursProps = {
  brand: string | null;
  background: string | null;
  locked: boolean;
  /** The value being typed, so the preview follows it; `undefined` when nothing is being changed. */
  onDraft: (key: ColourKey, value: string | undefined) => void;
  onSave: (change: BrandingChange) => Promise<boolean>;
};

/**
 * The two colours the sign-in page reads, each changed where it sits: a hex field with a picker
 * and suggestions, its Save and Cancel where Change was. How readable the brand colour is follows
 * the value being typed. The accent colour is saved but no sign-in page reads it, so it isn't
 * offered here (redesign findings: drop it).
 */
export function BrandingColours(props: BrandingColoursProps) {
  const { t } = useTranslation("branding");
  const [editing, setEditing] = useState<ColourKey | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [checked, setChecked] = useState(false);
  const saved =
    editing === "brand" ? props.brand : editing === "background" ? props.background : null;
  const typed = normalizeBrandColor(draft);
  const brand = editing === "brand" ? (draft.trim() ? typed : null) : props.brand;

  function open(key: ColourKey) {
    setEditing(key);
    setDraft((key === "brand" ? props.brand : props.background)?.toUpperCase() ?? "");
    setChecked(false);
  }

  function close() {
    if (editing) props.onDraft(editing, undefined);
    setEditing(null);
  }

  function change(value: string) {
    setDraft(value);
    if (!editing) return;
    const next = normalizeBrandColor(value);
    // "" is "back to the default"; an unfinished hex leaves the preview on the saved colour.
    props.onDraft(
      editing,
      value.trim() === "" ? (saved ? "" : undefined) : next && next !== saved ? next : undefined,
    );
  }

  async function save() {
    if (!editing || saving) return;
    setChecked(true);
    if (draft.trim() && !typed) return;
    if ((typed ?? null) === (saved ?? null)) return close();
    setSaving(true);
    const ok = await props.onSave(
      editing === "brand" ? { primary_color: typed } : { background_color: typed },
    );
    setSaving(false);
    if (ok) close();
  }

  const editor = (key: ColourKey) => {
    const label = t(key === "brand" ? "colours.brand" : "colours.background");
    const presets = key === "brand" ? BRAND_PRESETS : BACKGROUND_PRESETS;
    const invalid = checked && !!draft.trim() && !typed;
    return (
      <EditingDetail
        key={key}
        label={label}
        buttons={
          <>
            <Button variant="ghost" onClick={close} disabled={saving}>
              {t("colours.cancel")}
            </Button>
            <Button loading={saving} onClick={() => void save()}>
              {t("colours.save")}
            </Button>
          </>
        }
      >
        <form
          className="brand-colour-edit"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Input
            aria-label={label}
            aria-invalid={invalid || undefined}
            value={draft}
            onValueChange={change}
            maxLength={7}
            autoFocus
            placeholder={t(key === "brand" ? "colours.brandDefault" : "colours.backgroundDefault")}
            className="brand-hex"
            startAdornment={
              // Library gap (new): a colour field (swatch, hex and picker). The swatch is the
              // native picker; the tenant's colour is data, hence the inline style.
              <label
                className="brand-swatch brand-swatch-pick"
                style={{ background: typed ?? undefined }}
              >
                <input
                  type="color"
                  value={typed ?? (key === "brand" ? BRAND_PRESETS[0] : CARD)}
                  aria-label={t("colours.pick", { what: label.toLowerCase() })}
                  onChange={(event) => change(event.target.value.toUpperCase())}
                />
              </label>
            }
          />
          <fieldset className="brand-presets" aria-label={t("colours.presets")}>
            {presets.map((hex) => (
              <button
                key={hex}
                type="button"
                className="brand-preset"
                style={{ background: hex }}
                aria-label={t("colours.preset", { hex: hex.toUpperCase() })}
                aria-pressed={typed === hex}
                onClick={() => change(hex.toUpperCase())}
              />
            ))}
            <Button variant="ghost" size="sm" onClick={() => change("")}>
              {t(key === "brand" ? "colours.useDefault" : "colours.useAutomatic")}
            </Button>
          </fieldset>
          {invalid && (
            <Text size="sm" tone="danger" role="alert">
              {t("colours.invalid")}
            </Text>
          )}
        </form>
      </EditingDetail>
    );
  };

  return (
    <Section title={t("colours.title")}>
      <dl className="account-details">
        {editing === "brand" ? (
          editor("brand")
        ) : (
          <Detail
            label={t("colours.brand")}
            hint={t("colours.brandHint")}
            action={
              <Button
                variant="ghost"
                disabled={props.locked || !!editing}
                onClick={() => open("brand")}
              >
                {t("colours.change")}
              </Button>
            }
          >
            <Swatch hex={props.brand} fallback={t("colours.brandDefault")} />
          </Detail>
        )}
        {editing === "background" ? (
          editor("background")
        ) : (
          <Detail
            label={t("colours.background")}
            hint={t("colours.backgroundHint")}
            action={
              <Button
                variant="ghost"
                disabled={props.locked || !!editing}
                onClick={() => open("background")}
              >
                {t("colours.change")}
              </Button>
            }
          >
            <Swatch hex={props.background} fallback={t("colours.backgroundDefault")} />
          </Detail>
        )}
      </dl>
      {brand && <Readability hex={brand} />}
    </Section>
  );
}

/** How readable links and button labels are in the brand colour, on the sign-in card. */
function Readability({ hex }: { hex: string }) {
  const { t } = useTranslation("branding");
  const label = brandingForeground(hex);
  const values = {
    hex: hex.toUpperCase(),
    link: brandingContrast(hex, CARD).toFixed(1),
    button: brandingContrast(hex, label).toFixed(1),
    label: t(label === "#ffffff" ? "colours.label.light" : "colours.label.dark"),
  };
  return brandingContrast(hex, CARD) < 4.5 ? (
    <Alert tone="warning" title={t("colours.hardTitle", values)}>
      {t("colours.hardBody", values)}
    </Alert>
  ) : (
    <Text size="sm" tone="subtle">
      {t("colours.fine", values)}
    </Text>
  );
}

function Swatch({ hex, fallback }: { hex: string | null; fallback: string }) {
  if (!hex) return <Text tone="subtle">{fallback}</Text>;
  return (
    <span className="brand-swatch-row">
      {/* The organisation's own colour (domain data), not a UI colour. */}
      <span className="brand-swatch" style={{ background: hex }} aria-hidden="true" />
      <span className="account-mono">{hex.toUpperCase()}</span>
    </span>
  );
}
