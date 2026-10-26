import { Select } from "@qeetrix/react";
import { useTranslation } from "react-i18next";

import { LANGUAGE_LABELS, OFFERED_LANGUAGES } from "@/i18n";

/** The console's language, for the entry pages' footer. Loaded only once a second one is offered. */
export function LanguagePicker() {
  const { t, i18n } = useTranslation("auth-flow");
  return (
    <Select
      aria-label={t("entry.language")}
      items={OFFERED_LANGUAGES.map((lng): { value: string; label: string } => ({
        value: lng,
        label: LANGUAGE_LABELS[lng],
      }))}
      value={i18n.resolvedLanguage ?? "en"}
      onValueChange={(lng) => lng && void i18n.changeLanguage(lng)}
    />
  );
}
