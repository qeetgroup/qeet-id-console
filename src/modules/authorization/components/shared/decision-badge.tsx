import { Badge } from "@qeetrix/ui";
import { CircleCheckIcon, CircleXIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import type { TranslationKey } from "@/i18n";
import type { Engine } from "@/modules/authorization/api/simulate";

// Engine names are protocol names, so they show as written.
export const ENGINE_LABELS: Record<Engine, string> = {
  authzen: "AuthZEN",
  abac: "ABAC",
  rbac: "RBAC",
  rebac: "ReBAC",
};

// Catalogue keys, shared with the simulator's engine picker.
export const ENGINE_DESCRIPTIONS: Record<Engine, TranslationKey> = {
  authzen: "authorization:simulator.engines.authzen.description",
  abac: "authorization:simulator.engines.abac.description",
  rbac: "authorization:simulator.engines.rbac.description",
  rebac: "authorization:simulator.engines.rebac.description",
};

/** Renders the ALLOW or DENY pill used for every decision. */
export function DecisionBadge({ allowed, className }: { allowed: boolean; className?: string }) {
  const { t } = useTranslation("authorization");
  return (
    <Badge variant={allowed ? "success" : "destructive"} className={className}>
      {allowed ? (
        <CircleCheckIcon className="size-3.5" aria-hidden />
      ) : (
        <CircleXIcon className="size-3.5" aria-hidden />
      )}
      {allowed ? t("decisionBadge.allow") : t("decisionBadge.deny")}
    </Badge>
  );
}

export function EngineBadge({ engine }: { engine: Engine }) {
  return (
    <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wide">
      {ENGINE_LABELS[engine]}
    </Badge>
  );
}
