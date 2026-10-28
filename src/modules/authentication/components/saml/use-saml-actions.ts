import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  type SamlConnection,
  useDeleteSamlConnection,
  useUpdateSamlConnection,
} from "@/modules/authentication/api/saml";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

/**
 * A SAML connection's actions. Each asks the person to confirm it's them (stepup.go); turning it
 * off and deleting it say what happens to people (the server: a connection that isn't on refuses
 * every sign-in through it; the accounts it made stay).
 */
export function useSamlActions() {
  const { t } = useTranslation("saml");
  const navigate = useNavigate();
  const runSensitive = useSensitiveAction();
  const updateM = useUpdateSamlConnection();
  const deleteM = useDeleteSamlConnection();

  return {
    pending: updateM.isPending || deleteM.isPending,
    setOn: (c: SamlConnection, on: boolean) =>
      runSensitive({
        capability: "connection.write",
        confirm: on
          ? undefined
          : {
              title: t("signIn.off.title", { name: c.name }),
              description: t("signIn.off.description", { name: c.name }),
              confirmLabel: t("signIn.off.confirm"),
              tone: "default",
            },
        actionLabel: on ? t("signIn.on.action") : t("signIn.off.action"),
        run: () =>
          updateM
            .mutateAsync({ id: c.id, status: on ? "active" : "disabled" })
            .then(() =>
              toast.success(
                on ? t("signIn.on.done", { name: c.name }) : t("signIn.off.done", { name: c.name }),
              ),
            ),
      }).catch(settleSensitiveAction),
    setIdpInitiated: (c: SamlConnection, allow: boolean) =>
      runSensitive({
        capability: "connection.write",
        confirm: allow
          ? {
              title: t("signIn.idpInitiated.confirmTitle", { name: c.name }),
              description: t("signIn.idpInitiated.confirmDescription", { name: c.name }),
              confirmLabel: t("signIn.idpInitiated.accept"),
              tone: "default",
            }
          : undefined,
        actionLabel: allow
          ? t("signIn.idpInitiated.acceptAction")
          : t("signIn.idpInitiated.stopAction"),
        run: () => updateM.mutateAsync({ id: c.id, allow_idp_initiated: allow }),
      }).catch(settleSensitiveAction),
    remove: (c: SamlConnection) =>
      runSensitive({
        capability: "connection.write",
        confirm: {
          title: t("signIn.delete.title", { name: c.name }),
          description: t("signIn.delete.description", { name: c.name }),
          confirmLabel: t("signIn.delete.confirm"),
          tone: "destructive",
        },
        actionLabel: t("signIn.delete.action"),
        run: () =>
          deleteM.mutateAsync(c.id).then(() => {
            void navigate({ to: "/auth/connections", replace: true });
          }),
      }).catch(settleSensitiveAction),
  };
}
