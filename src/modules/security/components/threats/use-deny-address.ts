import { useTranslation } from "react-i18next";

import { useAddIpRule, useIpRules } from "@/modules/security/api/ip-allowlist";
import { decide } from "@/modules/security/ip-model";
import { toastError } from "@/platform/errors/error-toast";
import { isStepUpRequired } from "@/platform/security/step-up";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

/**
 * Adds a deny rule for one address, from Anomalies or Bots, after a confirm that says what it
 * does to people: refused at once while the rules are enforced, nothing until then. The server
 * asks for a step-up, and refuses a rule that would block the caller's own address.
 */
export function useDenyAddress() {
  const { t } = useTranslation("security");
  const runSensitive = useSensitiveAction();
  const rules = useIpRules();
  const add = useAddIpRule();
  const enforced = rules.data?.enabled ?? false;

  /** The deny rule already covering `ip`, if one does. */
  const deniedBy = (ip: string) => {
    const d = decide(
      (rules.data?.items ?? []).filter((r) => r.action === "deny"),
      ip,
    );
    return d.allowed || d.reason !== "deny_rule" ? undefined : d.cidr;
  };

  const deny = (ip: string, label: string) =>
    runSensitive({
      capability: "policy.write",
      confirm: {
        title: t("deny.title", { ip }),
        description: enforced ? t("deny.descriptionOn", { ip }) : t("deny.descriptionOff", { ip }),
        confirmLabel: t("deny.confirm"),
        tone: "destructive",
      },
      actionLabel: t("deny.action"),
      // The hook keeps its error for a form; here a toast says it, unless a step-up was refused.
      run: () =>
        add.mutateAsync(
          { cidr: ip, label, action: "deny" },
          { onError: (err) => !isStepUpRequired(err) && toastError(err, t("deny.failed")) },
        ),
    }).catch(settleSensitiveAction);

  return { deny, deniedBy, enforced, pending: add.isPending, loaded: !!rules.data };
}
