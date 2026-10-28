import { QeetLogo } from "@qeetrix/icons";
import { Button, Text } from "@qeetrix/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { LogoField, type LogoStatus } from "@/shared/components/logo-field";

import { type BrandingChange, brandLogoSource, validBrandLogo } from "../branding-model";
import { Item, Panel, Section } from "./branding-parts";

/** The image's own size once it loads, for the logo's row; nothing until then. */
function useImageSize(src: string | null) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    setSize(null);
    if (!src) return;
    const image = new Image();
    image.onload = () =>
      image.naturalWidth > 0 && setSize({ width: image.naturalWidth, height: image.naturalHeight });
    image.src = src;
    return () => {
      image.onload = null;
    };
  }, [src]);
  return size;
}

export type BrandingLogoProps = {
  logo: string | null;
  orgName?: string;
  locked: boolean;
  /** The logo being chosen, so the preview follows it; `undefined` when nothing is being changed. */
  onDraft: (value: string | undefined) => void;
  onSave: (change: BrandingChange) => Promise<boolean>;
  onRemove: () => Promise<boolean>;
};

/**
 * The logo the sign-in page shows, in one row: what it is and its size, Replace and Remove. A
 * new one is chosen in a panel under the row (a file or an image's address). An uploaded file is
 * a data: URL, which emails can't show, so the section says so where it applies.
 */
export function BrandingLogo(props: BrandingLogoProps) {
  const { t } = useTranslation("branding");
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const size = useImageSize(props.logo);
  const source = props.logo ? brandLogoSource(props.logo) : null;
  const what =
    source?.kind === "file"
      ? t(`logo.file.${source.type}`)
      : source?.kind === "url"
        ? t("logo.url", { host: source.host })
        : "";
  const name = props.orgName ? t("logo.name", { name: props.orgName }) : t("logo.nameNoOrg");

  return (
    <Section title={t("logo.title")} description={t("logo.description")}>
      <ul className="account-rows">
        {props.logo ? (
          <Item
            icon={<img src={props.logo} alt="" className="brand-logo-thumb" />}
            name={name}
            line={size ? t("logo.size", { what, ...size }) : what}
            actions={
              !open && (
                <>
                  <Button variant="ghost" disabled={props.locked} onClick={() => setOpen(true)}>
                    {t("logo.replace")}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={props.locked}
                    loading={removing}
                    onClick={async () => {
                      setRemoving(true);
                      await props.onRemove();
                      setRemoving(false);
                    }}
                  >
                    {t("logo.remove")}
                  </Button>
                </>
              )
            }
          />
        ) : (
          <Item
            icon={<QeetLogo height={16} alt="" />}
            name={t("logo.none")}
            line={t("logo.noneLine")}
            actions={
              !open && (
                <Button variant="ghost" disabled={props.locked} onClick={() => setOpen(true)}>
                  {t("logo.add")}
                </Button>
              )
            }
          />
        )}
        {open && (
          <LogoPanel
            current={props.logo}
            onDraft={props.onDraft}
            onSave={props.onSave}
            onClose={() => {
              props.onDraft(undefined);
              setOpen(false);
            }}
          />
        )}
      </ul>
      {source?.kind === "file" && (
        <Text size="sm" tone="subtle">
          {t("logo.emailNote")}
        </Text>
      )}
    </Section>
  );
}

function LogoPanel({
  current,
  onDraft,
  onSave,
  onClose,
}: {
  current: string | null;
  onDraft: (value: string | undefined) => void;
  onSave: (change: BrandingChange) => Promise<boolean>;
  onClose: () => void;
}) {
  const { t } = useTranslation("branding");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<LogoStatus>("empty");
  const [saving, setSaving] = useState(false);
  const ready = !!value.trim() && status === "ready" && validBrandLogo(value);

  return (
    <Panel
      as="li"
      title={t(current ? "logo.panelReplace" : "logo.panelAdd")}
      description={t("logo.panelDescription")}
    >
      <div className="account-panel-form brand-logo-form">
        <LogoField
          value={value}
          onChange={(next) => {
            setValue(next);
            onDraft(next.trim() ? next : undefined);
          }}
          onStatusChange={setStatus}
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          maxSizeMB={2}
          hint={t("logo.hint")}
          disabled={saving}
        />
        {value.trim() && !validBrandLogo(value) && (
          <Text size="sm" tone="danger" role="alert">
            {t("logo.invalid")}
          </Text>
        )}
      </div>
      <span className="account-panel-actions">
        <Button
          loading={saving}
          disabled={!ready}
          onClick={async () => {
            setSaving(true);
            const ok = await onSave({ logo_url: value });
            setSaving(false);
            if (ok) onClose();
          }}
        >
          {t("logo.use")}
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          {t("logo.cancel")}
        </Button>
      </span>
    </Panel>
  );
}
