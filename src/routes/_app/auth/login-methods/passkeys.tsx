import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@qeetrix/ui";
import { errorMessage } from "@/platform/errors/user-message";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FingerprintPatternIcon, PlusIcon, RefreshCwIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  canAddPasskey,
  type PasskeyList,
  PASSKEYS_KEY,
  PasskeysTable,
  passkeyDisplayName,
  useRegisterPasskey,
  useRemovePasskey,
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

const SKELETON_IDS = ["a", "b", "c"] as const;

function PasskeysPage() {
  const { t } = useTranslation("auth");
  const [confirmDialog, openConfirm] = useConfirmDialog();

  const listQ = useQuery({
    queryKey: PASSKEYS_KEY,
    queryFn: () => api<PasskeyList>("/v1/passkeys"),
  });

  const deleteM = useRemovePasskey();
  const renameM = useRenamePasskey();

  // No name is asked for: the server names the passkey after this browser, and it can be renamed
  // in the list. API and WebAuthn errors alike are toasted as user-safe copy.
  const registerM = useRegisterPasskey();
  const register = () =>
    registerM.mutate(undefined, {
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
            {/* Not offered when the organization has passkeys switched off. */}
            {canAddPasskey(listQ.data) && (
              <Button size="sm" onClick={register} disabled={registerM.isPending}>
                <PlusIcon />{" "}
                {registerM.isPending
                  ? t("loginMethods.passkeys.registeringBtn")
                  : t("loginMethods.passkeys.registerBtn")}
              </Button>
            )}
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
            {listQ.data && !canAddPasskey(listQ.data) && (
              <> · {t("loginMethods.passkeys.disabled")}</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {listQ.isLoading ? (
            <div className="space-y-3 p-4">
              {SKELETON_IDS.map((id) => (
                <Skeleton key={id} className="h-10 w-full" />
              ))}
            </div>
          ) : listQ.isError ? (
            <div className="p-6 text-sm text-destructive">{errorMessage(listQ.error)}</div>
          ) : !listQ.data?.items?.length ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <FingerprintPatternIcon className="size-8 text-muted-foreground" />
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
