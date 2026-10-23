import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@qeetrix/ui";
import { LoaderCircleIcon, PlusIcon, SmartphoneIcon, TrashIcon } from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { errorMessage } from "@/platform/errors/user-message";
import { isStepUpRequired } from "@/platform/security/step-up";
import { useConfirmDialog } from "@/shared/components/confirm-dialog";
import { type PushDeviceScope, usePushDevices, useRemovePushDevice } from "../api/push-devices";
import { LinkPhoneDialog } from "./link-phone-dialog";

/**
 * Renders the phones linked to approve sign-ins with Qeet Auth; a removed phone stops approving at
 * once. `scope` is the person's own phones, where one can also be linked by pairing code, or an
 * administrator's view of a member's, removed without touching the member's other factors.
 */
export function LinkedPhonesCard({
  scope,
  canRemove = true,
  className,
}: {
  scope: PushDeviceScope;
  canRemove?: boolean; // False shows the phones without the remove action
  className?: string;
}) {
  const { t } = useTranslation("account");
  const [confirmDialog, openConfirm] = useConfirmDialog();
  const [linking, setLinking] = useState(false);
  const phonesQ = usePushDevices(scope);
  const remove = useRemovePushDevice(scope);
  const phones = phonesQ.data?.items ?? [];
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
  // A cancelled step-up is not a failure to show: nothing was changed.
  const removeError = remove.error && !isStepUpRequired(remove.error) ? remove.error : null;

  function removePhone(id: string) {
    remove.mutate(id, { onSuccess: () => toast.success(t("security.phones.removed")) });
  }

  return (
    <Card className={className}>
      {confirmDialog}
      {scope.kind === "self" && <LinkPhoneDialog open={linking} onOpenChange={setLinking} />}
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SmartphoneIcon className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">{t("security.phones.title")}</CardTitle>
          </div>
          {scope.kind === "self" && (
            <Button variant="outline" size="sm" onClick={() => setLinking(true)}>
              <PlusIcon /> {t("security.phones.link")}
            </Button>
          )}
        </div>
        <CardDescription>
          {t(
            scope.kind === "self"
              ? "security.phones.description"
              : "security.phones.memberDescription",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {phonesQ.isLoading && (
          <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" />
        )}
        {phonesQ.isError && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(phonesQ.error)}
          </p>
        )}
        {phonesQ.isSuccess && phones.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("security.phones.empty")}</p>
        )}
        {phones.length > 0 && (
          <ul className="divide-y rounded-md border">
            {phones.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 px-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <SmartphoneIcon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {p.name || t(`security.phones.platform.${p.platform}`)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t(`security.phones.platform.${p.platform}`)}
                      {" · "}
                      {t("security.phones.linked", { date: date(p.created_at) })}
                      {" · "}
                      {t("security.phones.lastUsed", { date: date(p.last_seen_at) })}
                    </p>
                  </div>
                </div>
                {canRemove && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={remove.isPending}
                    onClick={() =>
                      openConfirm({
                        title: t("security.phones.removeConfirm", {
                          name: p.name || t(`security.phones.platform.${p.platform}`),
                        }),
                        description: t(
                          scope.kind === "self"
                            ? "security.phones.removeDescription"
                            : "security.phones.removeMemberDescription",
                        ),
                        variant: "destructive",
                        confirmLabel: t("security.phones.remove"),
                        onConfirm: () => removePhone(p.id),
                      })
                    }
                  >
                    <TrashIcon /> {t("security.phones.remove")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {removeError ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(removeError)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
