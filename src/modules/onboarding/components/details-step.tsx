import { ArrowRightIcon, CreditCardIcon } from "@qeetrix/icons";
import { Button, Field, Select, TextField } from "@qeetrix/react";
import { Alert, FileUpload } from "@qeetrix/react/experimental";
import { type FormEvent, type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { REGIONS } from "@/shared/data/regions";

import { slugify } from "../plan-catalog";

export interface OrganisationDetails {
  name: string;
  slug: string;
  slugEdited: boolean; // once typed in, the URL stops following the name
  region: string;
}

export interface Logo {
  url: string; // a data: URL of the chosen image
  name: string;
  size: number;
}

const SLUG = /^[a-z0-9-]{2,64}$/;
const MAX_LOGO_BYTES = 2_000_000;
// What the server accepts as an inline logo; anything else never reaches an element or a request.
export const INLINE_IMAGE = /^data:image\/(png|jpeg|svg\+xml|webp);base64,/i;

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string" && INLINE_IMAGE.test(reader.result)
        ? resolve(reader.result)
        : reject(new Error("unreadable"));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * The organisation's name, URL, region and logo. The URL follows the name until it's typed in.
 * Sending creates it (Free) or opens the payment page (a paid plan); a taken URL is reported on
 * its field, any other failure above the actions.
 */
export function DetailsStep({
  details,
  onDetailsChange,
  logo,
  onLogoChange,
  paid,
  busy,
  slugTaken,
  error,
  notice,
  onBack,
  onSubmit,
}: {
  details: OrganisationDetails;
  onDetailsChange: (details: OrganisationDetails) => void;
  logo: Logo | null;
  onLogoChange: (logo: Logo | null) => void;
  paid: boolean;
  busy: boolean;
  slugTaken: string | null; // the URL the server said is taken
  error: string | null;
  notice?: ReactNode; // above the fields, e.g. that a payment was cancelled
  onBack: () => void;
  onSubmit: () => void;
}) {
  const { t, i18n } = useTranslation("onboarding");
  const [checked, setChecked] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const name = details.name.trim();
  const slug = details.slug.trim();
  const nameError = checked && !name ? t("create.details.nameRequired") : undefined;
  const slugError =
    slugTaken && slugTaken === slug
      ? t("create.details.slugTaken", { slug })
      : checked && !SLUG.test(slug)
        ? t("create.details.slugInvalid")
        : undefined;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setChecked(true);
    if (!name || !SLUG.test(slug) || slugTaken === slug) return;
    onSubmit();
  }

  return (
    <form className="create-form" aria-busy={busy} noValidate onSubmit={submit}>
      {notice}
      <TextField
        label={t("create.details.name")}
        name="name"
        autoComplete="organization"
        placeholder={t("create.details.namePlaceholder")}
        description={t("create.details.nameHint")}
        error={nameError}
        value={details.name}
        onChange={(event) => {
          const value = event.target.value;
          onDetailsChange({
            ...details,
            name: value,
            slug: details.slugEdited ? details.slug : slugify(value),
          });
        }}
        disabled={busy}
      />
      <TextField
        label={t("create.details.slug")}
        name="slug"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        maxLength={64}
        placeholder={t("create.details.slugPlaceholder")}
        description={t("create.details.slugHint")}
        error={slugError}
        value={details.slug}
        onChange={(event) =>
          onDetailsChange({ ...details, slug: event.target.value, slugEdited: true })
        }
        disabled={busy}
      />
      <Field label={t("create.details.region")} description={t("create.details.regionHint")}>
        <Select
          items={REGIONS.map((region) => ({ value: region.value, label: i18n.t(region.label) }))}
          value={details.region}
          onValueChange={(region) => region && onDetailsChange({ ...details, region })}
          disabled={busy}
        />
      </Field>
      <Field
        label={t("create.details.logo")}
        optional
        description={t("create.details.logoHint")}
        error={logoError ?? undefined}
      >
        <div className="create-logo">
          {logo && <img src={logo.url} alt={t("create.details.logoPreview")} />}
          <FileUpload
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            maxSize={MAX_LOGO_BYTES}
            hint={t("create.details.logoTypes")}
            items={logo ? [{ id: "logo", name: logo.name, size: logo.size, status: "done" }] : []}
            onSelect={([file]) => {
              if (!file) return;
              setLogoError(null);
              readImage(file).then(
                (url) => onLogoChange({ url, name: file.name, size: file.size }),
                () => setLogoError(t("create.details.logoUnreadable")),
              );
            }}
            onRemove={() => onLogoChange(null)}
            disabled={busy}
          />
        </div>
      </Field>
      {error && (
        <Alert tone="danger" title={t("create.details.failedTitle")} announce="urgent">
          {error}
        </Alert>
      )}
      <div className="create-actions">
        <Button variant="ghost" size="lg" className="create-back" onClick={onBack} disabled={busy}>
          {t("create.back")}
        </Button>
        <Button
          type="submit"
          size="lg"
          icon={paid ? CreditCardIcon : ArrowRightIcon}
          loading={busy}
        >
          {t(
            busy
              ? paid
                ? "create.details.opening"
                : "create.details.creating"
              : paid
                ? "create.details.payment"
                : "create.details.create",
          )}
        </Button>
      </div>
    </form>
  );
}
