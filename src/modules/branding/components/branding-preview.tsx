import {
  ChevronRightIcon,
  FingerprintPatternIcon,
  LockIcon,
  MailIcon,
  MonitorIcon,
  QeetWordmarkLogo,
  SmartphoneIcon,
} from "@qeetrix/icons";
import { Heading, Text, Toggle, ToggleGroup } from "@qeetrix/react";
import { type CSSProperties, useState } from "react";
import { useTranslation } from "react-i18next";

import { brandingForeground } from "../branding-model";

export type PreviewValues = {
  logo: string | null;
  brand: string | null;
  background: string | null;
  host: string;
};

/**
 * The hosted sign-in page (qeet-id-hosted's AuthShell and AuthCard), drawn small with the values
 * on the page, including one being changed. On a larger screen: the brand panel (the logo, the
 * headline, a glow in the brand colour) beside the form on the page background. On a phone the
 * form stands alone on the card's surface, so the background doesn't show. The tenant's colours
 * are data, so they arrive as inline custom properties; the frame is always the light theme.
 */
export function BrandingPreview({ values }: { values: PreviewValues }) {
  const { t } = useTranslation("branding");
  const [mode, setMode] = useState<"desktop" | "phone">("desktop");
  const style = {
    ...(values.brand
      ? {
          "--brand-preview": values.brand,
          "--brand-preview-label": brandingForeground(values.brand),
        }
      : {}),
    ...(values.background ? { "--brand-preview-page": values.background } : {}),
  } as CSSProperties;
  const logo = (height: number) =>
    values.logo ? (
      <img src={values.logo} alt="" style={{ height }} className="brand-preview-logo" />
    ) : (
      <QeetWordmarkLogo variant="plain" height={height} alt="" />
    );

  return (
    <section className="brand-preview" aria-labelledby="branding-preview-title">
      <header className="brand-preview-head">
        <span>
          <Heading level={2} size="title-sm" id="branding-preview-title">
            {t("preview.title")}
          </Heading>
          <Text size="sm" tone="subtle">
            {t("preview.description")}
          </Text>
        </span>
        <ToggleGroup
          aria-label={t("preview.size")}
          value={[mode]}
          onValueChange={(value) => value[0] && setMode(value[0] as "desktop" | "phone")}
        >
          <Toggle value="desktop" icon={MonitorIcon} aria-label={t("preview.desktop")} />
          <Toggle value="phone" icon={SmartphoneIcon} aria-label={t("preview.phone")} />
        </ToggleGroup>
      </header>
      <figure className="brand-frame" data-mode={mode} data-qx-color-scheme="light" style={style}>
        <div className="brand-frame-bar">
          <span className="account-mono">{values.host}</span>
        </div>
        <div className="brand-frame-page" aria-hidden="true">
          {mode === "desktop" && (
            <div className="brand-panel">
              {logo(18)}
              <span className="brand-panel-line">
                {t("preview.headline")}
                <br />
                {t("preview.headlineSecond")}{" "}
                <span className="brand-panel-accent">{t("preview.headlineAccent")}</span>
              </span>
            </div>
          )}
          <div className="brand-form-side">
            <div className="brand-card">
              {logo(16)}
              <strong className="brand-card-title">{t("preview.signIn")}</strong>
              <span className="brand-card-line">{t("preview.line")}</span>
              <span className="brand-outline">
                <FingerprintPatternIcon size={12} />
                {t("preview.passkey")}
                <ChevronRightIcon size={10} className="brand-outline-end" />
              </span>
              <span className="brand-field-label">{t("preview.email")}</span>
              <span className="brand-field">
                <MailIcon size={11} />
                you@example.com
              </span>
              <span className="brand-field-label brand-field-row">
                {t("preview.password")}
                <span className="brand-link">{t("preview.forgot")}</span>
              </span>
              <span className="brand-field">
                <LockIcon size={11} />
              </span>
              <span className="brand-button">{t("preview.button")}</span>
              <span className="brand-quiet">{t("preview.link")}</span>
            </div>
          </div>
        </div>
      </figure>
      <Text size="sm" tone="subtle">
        {t("preview.note")}
      </Text>
    </section>
  );
}
