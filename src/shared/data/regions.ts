// Data-residency regions offered when creating or editing an organization; each label is a
// catalogue key.

import type { TranslationKey } from "@/i18n";

export const REGIONS: { value: string; label: TranslationKey }[] = [
  { value: "ap-south-1", label: "common:region.apSouth1" },
  { value: "us-east-1", label: "common:region.usEast1" },
  { value: "eu-west-1", label: "common:region.euWest1" },
];
