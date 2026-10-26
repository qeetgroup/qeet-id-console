import { formatRelativeTime } from "@qeetrix/react";

import { formatLocale } from "@/i18n";

/** A server timestamp relative to now, in the console's language: "3 hours ago", "in 7 days". */
export function relative(iso: string): string {
  return formatRelativeTime(new Date(iso), formatLocale());
}
