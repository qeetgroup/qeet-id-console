import {
  AppWindowIcon,
  CodeXmlIcon,
  FingerprintPatternIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  Settings2Icon,
  ShieldCheckIcon,
  UserRoundIcon,
  UsersIcon,
} from "@qeetrix/icons";
import type { ReactNode } from "react";

import type { TranslationKey } from "@/i18n";

/** A sidebar section. Modules fill it with entries through their manifests. */
export interface NavGroupDefinition {
  id: string;
  label: TranslationKey;
  icon: ReactNode; // rail icon for the two-pane sidebar switcher
}

/** The sidebar's sections, in order. */
export const NAV_GROUP_DEFINITIONS: readonly NavGroupDefinition[] = [
  { id: "overview", label: "common:navGroup.overview", icon: <LayoutDashboardIcon /> },
  { id: "directory", label: "common:navGroup.directory", icon: <UsersIcon /> },
  { id: "applications", label: "common:navGroup.applications", icon: <AppWindowIcon /> },
  {
    id: "authentication",
    label: "common:navGroup.authentication",
    icon: <FingerprintPatternIcon />,
  },
  { id: "authorization", label: "common:navGroup.authorization", icon: <KeyRoundIcon /> },
  { id: "security", label: "common:navGroup.security", icon: <ShieldCheckIcon /> },
  { id: "developer", label: "common:navGroup.developer", icon: <CodeXmlIcon /> },
  { id: "settings", label: "common:navGroup.settings", icon: <Settings2Icon /> },
  // The person's own pages, not the organisation's: shown flat, after Settings.
  { id: "account", label: "common:navGroup.account", icon: <UserRoundIcon /> },
];
