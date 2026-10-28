import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { LdapConnection } from "@/modules/authentication/api/ldap";
import {
  useDeleteLdapConnection,
  useTestLdapConnection,
  useUpdateLdapConnection,
} from "@/modules/authentication/api/ldap-actions";
import { hostnameOf } from "@/modules/authentication/connections-model";
import { normalizeError } from "@/platform/errors/normalize-error";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

/** The test's outcome, as the server answers it: passed, or why it failed. */
export type LdapTestOutcome =
  | { state: "running" }
  | { state: "passed"; at: number }
  | { state: "failed"; at: number; reason: LdapTestFailure };
export type LdapTestFailure = "unreachable" | "serviceAccount" | "certificate" | "other";

// The server's codes for a failed test (internal/platform/http/errs/ldap.go).
function failureOf(err: unknown): LdapTestFailure {
  const code = normalizeError(err).code;
  if (code === "ldap.dial_failed" || code === "ldap.directory_unreachable") return "unreachable";
  if (code === "ldap.service_bind_failed") return "serviceAccount";
  if (code === "ldap.tls_verify_required") return "certificate";
  return "other";
}

/**
 * One LDAP connection's actions. Test binds as the service account and nothing more, and needs no
 * step-up; the rest ask the person to confirm it's them. Each confirm says what happens to people
 * (the server: a draft or turned-off connection refuses every sign-in; deleting one keeps the
 * accounts, groups and roles of the people who signed in with it).
 */
export function useLdapActions() {
  const { t } = useTranslation("connections");
  const navigate = useNavigate();
  const runSensitive = useSensitiveAction();
  const testM = useTestLdapConnection();
  const updateM = useUpdateLdapConnection();
  const deleteM = useDeleteLdapConnection();
  const [outcome, setOutcome] = useState<LdapTestOutcome | null>(null);

  return {
    outcome,
    pending: updateM.isPending || deleteM.isPending,
    test: (c: LdapConnection) => {
      setOutcome({ state: "running" });
      return testM.mutateAsync(c.id).then(
        () => setOutcome({ state: "passed", at: Date.now() }),
        (err: unknown) => setOutcome({ state: "failed", at: Date.now(), reason: failureOf(err) }),
      );
    },
    setOn: (c: LdapConnection, on: boolean) =>
      runSensitive({
        capability: "connection.write",
        confirm: on
          ? undefined
          : {
              title: t("ldap.off.title", { name: c.name }),
              description: t("ldap.off.description", { host: hostnameOf(c.server_url) }),
              confirmLabel: t("ldap.off.confirm"),
              tone: "default",
            },
        actionLabel: on ? t("ldap.on.action") : t("ldap.off.action"),
        run: () =>
          updateM
            .mutateAsync({ id: c.id, status: on ? "active" : "disabled" })
            .then(() =>
              toast.success(
                on ? t("ldap.on.done", { name: c.name }) : t("ldap.off.done", { name: c.name }),
              ),
            ),
      }).catch(settleSensitiveAction),
    remove: (c: LdapConnection) =>
      runSensitive({
        capability: "connection.write",
        confirm: {
          title: t("ldap.delete.title", { name: c.name }),
          description: t("ldap.delete.description", { host: hostnameOf(c.server_url) }),
          confirmLabel: t("ldap.delete.confirm"),
          tone: "destructive",
        },
        actionLabel: t("ldap.delete.action"),
        run: () =>
          deleteM.mutateAsync(c.id).then(() => {
            toast.success(t("ldap.delete.done", { name: c.name }));
            void navigate({ to: "/directory/connections", replace: true });
          }),
      }).catch(settleSensitiveAction),
  };
}
