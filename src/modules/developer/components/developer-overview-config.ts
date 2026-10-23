// The developer overview's resource table and the class names its panels share.

import {
  KeyRoundIcon,
  LockKeyholeIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TicketIcon,
  WebhookIcon,
  ZapIcon,
} from "@qeetrix/icons";

import type { DeveloperResourceId } from "../api/overview";

export const RESOURCES = {
  keys: { icon: KeyRoundIcon, path: "/auth/api/keys", brand: true },
  tokens: { icon: TicketIcon, path: "/auth/api/tokens", brand: false },
  webhooks: { icon: WebhookIcon, path: "/developer/webhooks", brand: true },
  hooks: { icon: ZapIcon, path: "/developer/auth-hooks", brand: false },
  agents: { icon: SparklesIcon, path: "/developer/agents", brand: false },
  secrets: { icon: LockKeyholeIcon, path: "/auth/api/secrets", brand: false },
  credentials: { icon: ShieldCheckIcon, path: "/developer/credentials", brand: false },
};

// The steps of the integration checklist, in order.
export const CHECKLIST: DeveloperResourceId[] = [
  "keys",
  "webhooks",
  "hooks",
  "agents",
  "credentials",
];

export const PANEL =
  "min-w-0 overflow-hidden rounded-lg border border-border/65 bg-card/90 shadow-xs dark:border-border/80 dark:bg-card/70 dark:shadow-none";
export const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";
export const ACTION =
  "h-9 gap-2 rounded-md px-3.5 text-xs focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11";
export const INLINE_LINK =
  "inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-sm text-[11px] font-medium text-muted-foreground outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11";
