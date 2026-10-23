import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@qeetrix/ui";
import { FingerprintPatternIcon, PlusIcon, RefreshCwIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import {
  canAddPasskey,
  usePasskeys,
  useRegisterPasskey,
  useRemovePasskey,
  useRenamePasskey,
} from "../api/passkeys";
import { PasskeysTable, passkeyDisplayName } from "./passkeys-table";
import { toastError } from "@/platform/errors/error-toast";
import { PageHeader } from "@/platform/components/page-header";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { isStepUpRequired } from "@/platform/security/step-up";
import { DataState } from "@/platform/components/data-state";

/** Renders the signed-in person's passkeys with register, rename and remove. */
export function PasskeysPage() {
  const { t } = useTranslation("auth");
  const runSensitive = useSensitiveAction();

  const listQ = usePasskeys();

  const deleteM = useRemovePasskey();
  const renameM = useRenamePasskey();

  // No name is asked for: the server names the passkey after this browser, and it can be renamed
  // in the list. The hook is silent, so API and WebAuthn errors alike are toasted here as
  // user-safe copy, bar a cancelled step-up, which the step-up dialog has already reported.
  const registerM = useRegisterPasskey();
  const register = () =>
    runSensitive({
      actionLabel: t("loginMethods.passkeys.stepUp.register"),
      run: () =>
        registerM.mutateAsync(undefined, {
          onError: (e) => {
            if (!isStepUpRequired(e)) toastError(e);
          },
        }),
    }).catch(settleSensitiveAction);

  return (
    <div className="flex min-w-0 flex-col gap-4">
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
          <DataState
            isLoading={listQ.isLoading}
            isError={listQ.isError}
            error={listQ.error}
            isEmpty={!listQ.data?.items?.length}
            emptyIcon={FingerprintPatternIcon}
            emptyTitle={t("loginMethods.passkeys.list.empty")}
            skeletonRows={3}
          >
            <PasskeysTable
              passkeys={listQ.data?.items ?? []}
              onRename={(p, name) => renameM.mutateAsync({ id: p.id, name })}
              onRemove={(p) =>
                runSensitive({
                  confirm: {
                    title: t("loginMethods.passkeys.confirm.title", {
                      name: passkeyDisplayName(p, t("loginMethods.passkeys.unnamed")),
                    }),
                    confirmLabel: t("loginMethods.passkeys.confirm.label"),
                    tone: "destructive",
                  },
                  actionLabel: t("loginMethods.passkeys.stepUp.remove"),
                  run: () => deleteM.mutateAsync(p.id),
                }).catch(settleSensitiveAction)
              }
              isRemoving={deleteM.isPending}
            />
          </DataState>
        </CardContent>
      </Card>
    </div>
  );
}
