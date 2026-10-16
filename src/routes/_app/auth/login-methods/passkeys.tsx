import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@qeetrix/ui";
import { startRegistration } from "@simplewebauthn/browser";
import { errorMessage } from "@/platform/errors/user-message";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FingerprintIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  type Passkey,
  PASSKEYS_KEY,
  PasskeysTable,
  passkeyDisplayName,
  useRenamePasskey,
} from "@/modules/authentication";
import { api } from "@/platform/api/client";
import { normalizeError } from "@/platform/errors/normalize-error";
import { userMessageForCode } from "@/platform/errors/user-message";
import { PageHeader } from "@/platform/components/page-header";
import { useConfirmDialog } from "@/shared/components/confirm-dialog";

export const Route = createFileRoute("/_app/auth/login-methods/passkeys")({
  component: PasskeysPage,
});

function PasskeysPage() {
  const { t } = useTranslation("auth");
  const [confirmDialog, openConfirm] = useConfirmDialog();
  const qc = useQueryClient();

  const listQ = useQuery({
    queryKey: PASSKEYS_KEY,
    queryFn: () => api<{ items: Passkey[] }>("/v1/passkeys"),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => api<void>(`/v1/passkeys/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PASSKEYS_KEY }),
    meta: { successMessage: "Passkey removed" },
  });

  const renameM = useRenamePasskey();

  // Registration ceremony: ask the backend for creation options, drive the
  // browser WebAuthn API, then post the attestation back to finish. No name is
  // asked for: the server names the passkey after this browser (e.g. "Chrome
  // on macOS") and it can be renamed inline from the list.
  const registerM = useMutation({
    mutationFn: async () => {
      const begin = await api<{
        session_id: string;
        publicKey: Parameters<typeof startRegistration>[0]["optionsJSON"];
      }>("/v1/passkeys/register/begin", { method: "POST" });
      const credential = await startRegistration({
        optionsJSON: begin.publicKey,
      });
      await api<void>("/v1/passkeys/register/finish", {
        method: "POST",
        body: { session_id: begin.session_id, credential },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PASSKEYS_KEY }),
    // Own the error toast (silences the global handler) with user-safe copy —
    // covers both ApiError and WebAuthn browser errors without leaking raw text.
    meta: { silent: true },
    onError: (e) => {
      const appError = normalizeError(e);
      toast.error(userMessageForCode(appError.code, appError.kind));
    },
  });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {confirmDialog}
      <PageHeader
        description={t("loginMethods.passkeys.description")}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => listQ.refetch()}
              disabled={listQ.isFetching}
            >
              <RefreshCwIcon className={listQ.isFetching ? "animate-spin" : ""} />
              {t("loginMethods.passkeys.refreshBtn")}
            </Button>
            <Button size="sm" onClick={() => registerM.mutate()} disabled={registerM.isPending}>
              <PlusIcon />{" "}
              {registerM.isPending
                ? t("loginMethods.passkeys.registeringBtn")
                : t("loginMethods.passkeys.registerBtn")}
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("loginMethods.passkeys.list.title")}</CardTitle>
          <CardDescription>
            {t("loginMethods.passkeys.list.count", {
              count: listQ.data?.items?.length ?? 0,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {listQ.isLoading ? (
            <div className="space-y-3 p-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : listQ.isError ? (
            <div className="p-6 text-sm text-destructive">{errorMessage(listQ.error)}</div>
          ) : !listQ.data?.items?.length ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <FingerprintIcon className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {t("loginMethods.passkeys.list.empty")}
              </p>
            </div>
          ) : (
            <PasskeysTable
              passkeys={listQ.data.items}
              onRename={(p, name) => renameM.mutateAsync({ id: p.id, name })}
              onRemove={(p) =>
                openConfirm({
                  title: t("loginMethods.passkeys.confirm.title", {
                    name: passkeyDisplayName(p, t("loginMethods.passkeys.unnamed")),
                  }),
                  variant: "destructive",
                  confirmLabel: t("loginMethods.passkeys.confirm.label"),
                  onConfirm: () => deleteM.mutate(p.id),
                })
              }
              isRemoving={deleteM.isPending}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
