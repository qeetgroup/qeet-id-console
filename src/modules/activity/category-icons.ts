// An icon for each kind of event, by its category or domain, for lists that mark events with one.

import {
  ActivityIcon,
  FingerprintPatternIcon,
  GlobeIcon,
  type IconProps,
  KeyRoundIcon,
  LogInIcon,
  MonitorIcon,
  ServerIcon,
  ShieldAlertIcon,
  UserIcon,
  WebhookIcon,
} from "@qeetrix/icons";
import type { ComponentType } from "react";

const CATEGORY_ICONS: Record<string, ComponentType<IconProps<"outline">>> = {
  authentication: LogInIcon,
  authorization: ShieldAlertIcon,
  mfa: FingerprintPatternIcon,
  "api-key": KeyRoundIcon,
  apikey: KeyRoundIcon,
  webhook: WebhookIcon,
  user: UserIcon,
  session: MonitorIcon,
  system: ServerIcon,
  federation: GlobeIcon,
};

/** Returns the icon for an event category, or a generic one. */
export function getCategoryIcon(category: string): ComponentType<IconProps<"outline">> {
  const key = category.toLowerCase().replace(/[^a-z-]/g, "");
  return CATEGORY_ICONS[key] ?? ActivityIcon;
}
