import { ArrowLeft, RefreshArrow } from "@qeetrix/icons";
import {
  Button,
  cn,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qeetrix/ui";
import type { FormEventHandler } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { LogoField } from "@/shared/components/logo-field";
import { REGIONS } from "@/shared/data/regions";

import type { PlanSelection } from "./plan-select";
import { SetupPlanSummary } from "./setup-plan-summary";
import {
  SETUP_FIELDS,
  SETUP_FOCUS,
  SETUP_PANEL,
  SETUP_PRIMARY,
  SETUP_SECONDARY,
} from "./setup-styles";

export function SetupOrganizationForm({
  selection,
  name,
  slug,
  region,
  logo,
  busy,
  error,
  onNameChange,
  onSlugChange,
  onRegionChange,
  onLogoChange,
  onBack,
  onChangePlan,
  onSubmit,
}: {
  selection: PlanSelection;
  name: string;
  slug: string;
  region: string;
  logo: string;
  busy: boolean;
  error: string | null;
  onNameChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onLogoChange: (value: string) => void;
  onBack: () => void;
  onChangePlan: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
}) {
  const { t } = useTranslation("dashboard");
  const id = useId();
  const submitKey =
    selection.tier === "free"
      ? "create"
      : selection.tier === "enterprise"
        ? "enterprise"
        : "payment";

  return (
    <form
      className={cn(SETUP_PANEL, "flex flex-col p-5")}
      aria-label={t("setup.organization.title")}
      aria-busy={busy}
      onSubmit={onSubmit}
    >
      <div className="mb-4 hidden dark:block">
        <h2 className="font-sans text-base font-semibold">{t("setup.organization.title")}</h2>
        <p className="mt-1 text-xs leading-5 text-(--setup-muted)">
          {t("setup.organization.description")}
        </p>
      </div>
      <SetupPlanSummary selection={selection} disabled={busy} onChangePlan={onChangePlan} />

      <FieldGroup
        className={cn(
          SETUP_FIELDS,
          "mt-3 gap-2.5 [&_[data-slot=field]]:gap-0.75 [&_[data-slot=field-label]]:leading-3.5 [&_[data-slot=field-description]]:leading-3",
        )}
      >
        <Field disabled={busy}>
          <FieldLabel htmlFor={`${id}-name`}>{t("setup.organization.name")}</FieldLabel>
          <Input
            id={`${id}-name`}
            name="name"
            autoComplete="organization"
            placeholder={t("setup.organization.namePlaceholder")}
            required
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            aria-describedby={`${id}-name-hint`}
          />
          <FieldDescription id={`${id}-name-hint`} className="dark:hidden">
            {t("setup.organization.nameHint")}
          </FieldDescription>
        </Field>
        <Field disabled={busy}>
          <FieldLabel htmlFor={`${id}-slug`}>{t("setup.organization.slug")}</FieldLabel>
          <Input
            id={`${id}-slug`}
            name="slug"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            pattern={"[a-z0-9\\-]+"}
            minLength={2}
            maxLength={64}
            placeholder={t("setup.organization.slugPlaceholder")}
            required
            value={slug}
            onChange={(event) => onSlugChange(event.target.value)}
            aria-describedby={`${id}-slug-hint`}
          />
          <FieldDescription id={`${id}-slug-hint`}>
            {t("setup.organization.slugHint")}
          </FieldDescription>
        </Field>
        <Field disabled={busy}>
          <FieldLabel htmlFor={`${id}-region`}>{t("setup.organization.region")}</FieldLabel>
          <Select
            value={region}
            onValueChange={(value) => value && onRegionChange(value)}
            disabled={busy}
          >
            <SelectTrigger id={`${id}-region`} aria-describedby={`${id}-region-hint`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REGIONS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription id={`${id}-region-hint`} className="dark:hidden">
            {t("setup.organization.regionHint")}
          </FieldDescription>
        </Field>
        <Field disabled={busy}>
          <span className="text-xs font-medium">{t("setup.organization.logo")}</span>
          <LogoField
            value={logo}
            onChange={onLogoChange}
            disabled={busy}
            hint={t("setup.organization.logoHint")}
            className="gap-1.5 [&>button]:min-h-20 [&>button]:gap-1 [&>button]:rounded-lg [&>button]:border [&>button]:border-dashed [&>button]:border-(--setup-muted)/45 [&>button]:bg-(--setup-soft)/25 [&>button]:p-2 [&>button>svg]:size-5 [&>button>span:first-of-type]:text-xs [&>button>span:last-of-type]:text-[10px] [&>p]:text-[10px] [&>p]:leading-3"
          />
        </Field>
        {error && <FieldError>{error}</FieldError>}
      </FieldGroup>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          className={cn(SETUP_SECONDARY, SETUP_FOCUS)}
          onClick={onBack}
          disabled={busy}
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" /> {t("setup.back")}
        </Button>
        <Button
          type="submit"
          className={cn(SETUP_PRIMARY, SETUP_FOCUS)}
          disabled={busy || !name.trim() || slug.trim().length < 2}
        >
          {busy && (
            <RefreshArrow
              className="size-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          )}
          {t(`setup.organization.${busy ? "busy" : submitKey}`)}
        </Button>
      </div>
    </form>
  );
}
