import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  Input,
} from "@qeetrix/ui";
import { useMutation } from "@tanstack/react-query";
import { downloadBlob } from "@/shared/utils/data-export";
import { errorMessage } from "@/platform/errors/user-message";
import { createFileRoute } from "@tanstack/react-router";
import { DownloadIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useConfirmDialog } from "@/shared/components/confirm-dialog";
import { ApiError, api, tokenStore } from "@/platform/api/client";
import { usePasswordStatus } from "@/modules/authentication";

export const Route = createFileRoute("/account/data")({ component: DataPage });

function DataPage() {
  const { t } = useTranslation("account");
  const [confirmDialog, openConfirm] = useConfirmDialog();
  const hasPassword = usePasswordStatus().data?.has_password ?? true;
  const [password, setPassword] = useState("");

  // Self-service data export (§B9) and account erasure (§B10). Export returns
  // the user's portable data synchronously and downloads it as a JSON file.
  // Delete purges PII + credentials immediately (audit refs kept, redacted),
  // then — since the session is revoked server-side — drops the local session
  // and sends the user to sign-up.

  const exportM = useMutation({
    mutationFn: async () => {
      const data = await api<Record<string, unknown>>("/v1/account/export", { method: "POST" });
      downloadBlob(
        JSON.stringify(data, null, 2),
        "application/json",
        `qeet-id-account-export-${new Date().toISOString().slice(0, 10)}.json`,
      );
    },
    meta: { successMessage: "Your data has been downloaded" },
  });

  const deleteM = useMutation({
    mutationFn: () =>
      api<void>("/v1/account/delete", {
        method: "POST",
        body: hasPassword ? { password } : {},
      }),
    onSuccess: () => {
      tokenStore.clear();
      window.location.assign("/sign-up");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? errorMessage(err) : "Could not delete your account."),
    meta: { silent: true },
  });

  return (
    <div className="flex flex-col gap-4">
      {confirmDialog}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DownloadIcon className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">{t("data.export.title")}</CardTitle>
          </div>
          <CardDescription>{t("data.export.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => exportM.mutate()} disabled={exportM.isPending}>
            <DownloadIcon /> {t("data.export.button")}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-rose-500/40">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trash2Icon className="size-5 text-rose-600 dark:text-rose-400" />
            <CardTitle className="text-base">{t("data.delete.title")}</CardTitle>
          </div>
          <CardDescription>{t("data.delete.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {hasPassword && (
            <Field className="max-w-xs">
              <FieldLabel htmlFor="delete-password">Confirm your password</FieldLabel>
              <Input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          )}
          <Button
            variant="outline"
            className="w-fit border-rose-500/40 text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
            onClick={() =>
              openConfirm({
                title: t("data.delete.confirm.title"),
                description: t("data.delete.confirm.description"),
                variant: "destructive",
                confirmLabel: t("data.delete.confirm.label"),
                onConfirm: () => deleteM.mutate(),
              })
            }
            disabled={deleteM.isPending || (hasPassword && !password)}
          >
            <Trash2Icon /> {t("data.delete.button")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
