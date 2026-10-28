import { formatNumber } from "@qeetrix/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { formatLocale } from "@/i18n";
import type { DirectoryEvent } from "@/modules/directory/api/directory";
import { type ErrorActionResult, useDirectoryErrorAction } from "@/modules/directory/api/sync";
import { errorMessage } from "@/platform/errors/user-message";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

/**
 * Check again and Mark resolved, for one failure or several. A check runs only for the failures
 * the server can retry (open LDAP connection checks); a pass closes the failure it reran. Marking
 * resolved is confirmed first: it records who and when and changes nothing on the connection.
 */
export function useErrorActions(nameOf: (connectionId: string) => string) {
  const { t } = useTranslation("directory");
  const runSensitive = useSensitiveAction();
  const action = useDirectoryErrorAction();
  const n = (value: number) => formatNumber(value, formatLocale());

  /** Reruns the checks; resolves with how it went, or undefined when the call failed. */
  async function checkAgain(events: readonly DirectoryEvent[]) {
    const targets = events.filter((e) => e.retryable && e.resolution === "open");
    if (!targets.length) return undefined;
    let result: ErrorActionResult;
    try {
      result = await action.mutateAsync({ events: targets, action: "retry" });
    } catch (err) {
      toast.error(t("errors.toast.stillFailing"), { description: errorMessage(err) });
      return undefined;
    }
    const one = targets.length === 1;
    if (result.stillOpen)
      toast.error(
        one
          ? t("errors.toast.stillFailing")
          : t("errors.toast.stillFailingMany", { n: n(result.stillOpen) }),
      );
    else if (result.closed)
      toast.success(
        one
          ? t("errors.toast.passed", { name: nameOf(targets[0]?.connection_id ?? "") })
          : t("errors.toast.passedMany", { count: result.closed, n: n(result.closed) }),
      );
    if (result.refused)
      toast.info(t("errors.toast.refused", { count: result.refused, n: n(result.refused) }));
    return result;
  }

  /** Marks the open ones resolved, after the confirm. */
  function markResolved(events: readonly DirectoryEvent[]) {
    const targets = events.filter((e) => e.resolution === "open");
    if (!targets.length) return Promise.resolve();
    return runSensitive({
      capability: "connection.write",
      confirm: {
        title: t("errors.resolve.title", { count: targets.length, n: n(targets.length) }),
        description: t("errors.resolve.description"),
        confirmLabel: t("errors.resolve.confirm"),
        tone: "default",
      },
      actionLabel: t("errors.resolve.action"),
      run: () =>
        action.mutateAsync({ events: targets, action: "resolve" }).then(
          (result) => {
            if (result.closed)
              toast.success(
                t("errors.toast.resolved", { count: result.closed, n: n(result.closed) }),
              );
            if (result.refused)
              toast.info(
                t("errors.toast.refused", { count: result.refused, n: n(result.refused) }),
              );
          },
          (err: unknown) => toast.error(errorMessage(err)),
        ),
    }).catch(settleSensitiveAction);
  }

  return { pending: action.isPending, checkAgain, markResolved };
}
