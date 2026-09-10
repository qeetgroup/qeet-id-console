import { ArrowLeft, ArrowRight } from "@qeetrix/icons";
import {
  Button,
  cn,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qeetrix/ui";
import type { Dispatch, SetStateAction } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { type OnboardingProfile, ROLES, TEAM_SIZES, USE_CASES } from "./onboarding-profile";
import type { PlanSelection } from "./plan-select";
import { SetupPlanSummary } from "./setup-plan-summary";
import {
  SETUP_FIELDS,
  SETUP_FOCUS,
  SETUP_PANEL,
  SETUP_PRIMARY,
  SETUP_SECONDARY,
} from "./setup-styles";

export function SetupProjectForm({
  selection,
  profile,
  onProfileChange,
  onBack,
  onContinue,
  onSkip,
}: {
  selection: PlanSelection;
  profile: OnboardingProfile;
  onProfileChange: Dispatch<SetStateAction<OnboardingProfile>>;
  onBack: () => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation("dashboard");
  const id = useId();
  const fields = [
    { key: "use_case", label: "useCase", options: USE_CASES },
    { key: "team_size", label: "teamSize", options: TEAM_SIZES },
    { key: "role", label: "role", options: ROLES },
  ] as const;

  return (
    <form
      className={cn(SETUP_PANEL, "flex flex-col p-5")}
      aria-labelledby={`${id}-title`}
      onSubmit={(event) => {
        event.preventDefault();
        onContinue();
      }}
    >
      <div className="mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            id={`${id}-title`}
            tabIndex={-1}
            className="font-sans text-lg font-semibold leading-6 tracking-tight outline-none"
          >
            {t("setup.profile.title")}
          </h2>
          <span className="rounded-full bg-(--setup-border)/60 px-2 py-0.5 text-[10px] text-(--setup-muted)">
            {t("setup.optional")}
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-5 text-(--setup-muted)">
          {t("setup.profile.description")}
        </p>
      </div>
      <SetupPlanSummary selection={selection} onChangePlan={onBack} />
      <FieldGroup className={cn(SETUP_FIELDS, "mt-4 flex-1 gap-5")}>
        {fields.map(({ key, label, options }) => (
          <Field key={key}>
            <FieldLabel htmlFor={`${id}-${key}`}>{t(`setup.profile.${label}`)}</FieldLabel>
            <Select
              value={profile[key] ?? ""}
              onValueChange={(value) =>
                onProfileChange((previous) => ({ ...previous, [key]: value || undefined }))
              }
            >
              <SelectTrigger id={`${id}-${key}`} aria-describedby={`${id}-${key}-hint`}>
                <SelectValue placeholder={t("setup.profile.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription id={`${id}-${key}-hint`}>
              {t(`setup.profile.${label}Hint`)}
            </FieldDescription>
          </Field>
        ))}
      </FieldGroup>
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-(--setup-border) pt-3">
        <Button
          type="button"
          variant="outline"
          className={cn(SETUP_SECONDARY, SETUP_FOCUS)}
          onClick={onBack}
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" /> {t("setup.back")}
        </Button>
        <button
          type="button"
          className={cn(
            "ms-auto min-h-9 cursor-pointer rounded px-2 text-[11px] text-(--setup-muted) underline underline-offset-2 pointer-coarse:min-h-11",
            SETUP_FOCUS,
          )}
          onClick={onSkip}
        >
          {t("setup.skip")}
        </button>
        <Button type="submit" className={cn(SETUP_PRIMARY, SETUP_FOCUS)}>
          {t("setup.continue")} <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </form>
  );
}
