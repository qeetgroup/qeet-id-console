// Team-size bands, asked during onboarding and on the contact-sales form; each label is a
// catalogue key.

import type { TranslationKey } from "@/i18n";

export const TEAM_SIZES: { value: string; label: TranslationKey }[] = [
  { value: "solo", label: "common:teamSize.solo" },
  { value: "2-10", label: "common:teamSize.upTo10" },
  { value: "11-50", label: "common:teamSize.upTo50" },
  { value: "51-200", label: "common:teamSize.upTo200" },
  { value: "200+", label: "common:teamSize.over200" },
];
