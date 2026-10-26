import { ArrowRightIcon } from "@qeetrix/icons";
import { Button, Field, Select } from "@qeetrix/react";
import { useTranslation } from "react-i18next";

import { TEAM_SIZES } from "@/shared/data/team-sizes";

import { type OnboardingProfile, ROLES, USE_CASES } from "../onboarding-profile";

const QUESTIONS = [
  { key: "use_case", label: "useCase", options: USE_CASES },
  { key: "team_size", label: "teamSize", options: TEAM_SIZES },
  { key: "role", label: "role", options: ROLES },
] as const;

/** The optional questions that order the first-run checklist. Skip clears what was answered. */
export function ProjectStep({
  profile,
  onProfileChange,
  onBack,
  onContinue,
  onSkip,
}: {
  profile: OnboardingProfile;
  onProfileChange: (profile: OnboardingProfile) => void;
  onBack: () => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const { t, i18n } = useTranslation("onboarding");
  return (
    <form
      className="create-form"
      onSubmit={(event) => {
        event.preventDefault();
        onContinue();
      }}
    >
      {QUESTIONS.map(({ key, label, options }) => (
        <Field
          key={key}
          label={t(`create.project.${label}`)}
          description={t(`create.project.${label}Hint`)}
        >
          <Select
            items={options.map((option) => ({ value: option.value, label: i18n.t(option.label) }))}
            value={profile[key] ?? null}
            onValueChange={(value) => onProfileChange({ ...profile, [key]: value ?? undefined })}
            placeholder={t("create.project.placeholder")}
          />
        </Field>
      ))}
      <div className="create-actions">
        <Button variant="ghost" size="lg" className="create-back" onClick={onBack}>
          {t("create.back")}
        </Button>
        <Button variant="ghost" size="lg" onClick={onSkip}>
          {t("create.project.skip")}
        </Button>
        <Button type="submit" size="lg" icon={ArrowRightIcon}>
          {t("create.continue")}
        </Button>
      </div>
    </form>
  );
}
