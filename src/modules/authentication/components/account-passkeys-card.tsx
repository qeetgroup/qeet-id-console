import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  StatusPill,
} from "@qeetrix/ui";
import { FingerprintPatternIcon, LoaderCircleIcon, PlusIcon } from "@qeetrix/icons";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { errorMessage } from "@/platform/errors/user-message";
import { useConfirmDialog } from "@/shared/components/confirm-dialog";
import {
  canAddPasskey,
  PASSKEY_NAME_MAX_LENGTH,
  usePasskeys,
  useRegisterPasskey,
  useRemovePasskey,
  useRenamePasskey,
} from "../api/passkeys";
import { isLastSignInMethod, useSignInMethods } from "../api/sign-in-methods";
import { PasskeysTable, passkeyDisplayName } from "./passkeys-table";

/**
 * Renders the Passkeys card of the user's own security settings: rename, remove, and add with an
 * optional name. Adding is offered only when their organization allows passkeys.
 */
export function AccountPasskeysCard({ className }: { className?: string }) {
  const { t } = useTranslation("account");
  const { t: tAuth } = useTranslation("auth");
  const [confirmDialog, openConfirm] = useConfirmDialog();
  const passkeysQ = usePasskeys();
  const rename = useRenamePasskey();
  const register = useRegisterPasskey();
  const remove = useRemovePasskey();
  const methodsQ = useSignInMethods();
  const lastMethod = isLastSignInMethod(methodsQ.data);
  const [name, setName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const passkeys = passkeysQ.data?.items ?? [];

  function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddError(null);
    register.mutate(
      { name },
      {
        onSuccess: () => {
          setName("");
          toast.success(t("security.passkeys.added"));
        },
        // A dismissed browser prompt is not a failure worth alarming about;
        // anything else gets the user-safe copy for its code.
        onError: (err) =>
          setAddError(
            err instanceof Error && err.name === "NotAllowedError"
              ? t("security.passkeys.cancelled")
              : errorMessage(err),
          ),
      },
    );
  }

  return (
    <Card className={className}>
      {confirmDialog}
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FingerprintPatternIcon className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">{t("security.passkeys.title")}</CardTitle>
          </div>
          <StatusPill status={passkeys.length > 0 ? "active" : "pending"} dot={false}>
            {passkeys.length > 0
              ? t("security.passkeys.enrolled", { count: passkeys.length })
              : t("security.passkeys.notEnrolled")}
          </StatusPill>
        </div>
        <CardDescription>{t("security.passkeys.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {passkeys.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <PasskeysTable
              passkeys={passkeys}
              onRename={(p, newName) => rename.mutateAsync({ id: p.id, name: newName })}
              onRemove={(p) =>
                openConfirm({
                  title: t("security.passkeys.removeConfirm", {
                    name: passkeyDisplayName(p, tAuth("loginMethods.passkeys.unnamed")),
                  }),
                  variant: "destructive",
                  confirmLabel: t("security.passkeys.remove"),
                  onConfirm: () => remove.mutate(p.id),
                })
              }
              isRemoving={remove.isPending}
              removeBlockedReason={lastMethod ? t("security.lastMethod") : undefined}
            />
          </div>
        )}
        {remove.error ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(remove.error)}
          </p>
        ) : null}
        {passkeysQ.isSuccess &&
          (canAddPasskey(passkeysQ.data) ? (
            <form onSubmit={add} className="grid max-w-md gap-3">
              <Field>
                <FieldLabel htmlFor="new-passkey-name">
                  {t("security.passkeys.nameLabel")}
                </FieldLabel>
                <Input
                  id="new-passkey-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={tAuth("loginMethods.passkeys.rename.placeholder")}
                  maxLength={PASSKEY_NAME_MAX_LENGTH}
                  autoComplete="off"
                />
                <FieldDescription>{t("security.passkeys.nameHint")}</FieldDescription>
              </Field>
              {addError ? (
                <p role="alert" className="text-sm text-destructive">
                  {addError}
                </p>
              ) : null}
              <div>
                <Button type="submit" size="sm" disabled={register.isPending}>
                  {register.isPending ? (
                    <LoaderCircleIcon className="animate-spin" />
                  ) : (
                    <PlusIcon />
                  )}
                  {register.isPending ? t("security.passkeys.adding") : t("security.passkeys.add")}
                </Button>
              </div>
            </form>
          ) : (
            <p role="status" className="text-sm text-muted-foreground">
              {t("security.passkeys.disabled")}
            </p>
          ))}
      </CardContent>
    </Card>
  );
}
