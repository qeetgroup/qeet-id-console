import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FieldGroup,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@qeetrix/ui";
import { formatLocale } from "@/i18n";
import { ErrorText } from "@/platform/components/error-reference";
import { PlusIcon, RefreshCwIcon, ScrollTextIcon, ShieldCheckIcon } from "@qeetrix/icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useConfirmDialog } from "@/shared/components/confirm-dialog";
import { PageHeader } from "@/platform/components/page-header";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { useCancelGdprPurge, useCreateGdprPurge, useGdprPurges } from "../api/gdpr";

const SKELETON_IDS = ["a", "b", "c"] as const;

/** Renders GDPR erasure requests, with file and cancel. */
export function GdprPage() {
  const { t } = useTranslation("compliance");
  const [confirmDialog, openConfirm] = useConfirmDialog();
  const [creating, setCreating] = useState(false);

  const listQ = useGdprPurges();
  const cancelM = useCancelGdprPurge();

  const itemCount = listQ.data?.items?.length ?? 0;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {confirmDialog}
      <PageHeader
        description={t("gdpr.description")}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => listQ.refetch()}
              disabled={listQ.isFetching}
            >
              <RefreshCwIcon className={listQ.isFetching ? "animate-spin" : ""} />
              {t("gdpr.refresh")}
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              <PlusIcon /> {t("gdpr.fileRequest")}
            </Button>
          </>
        }
      />

      <Card className="border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/20">
        <CardContent className="flex items-start gap-3 p-4">
          <ShieldCheckIcon className="size-5 text-emerald-700 dark:text-emerald-500" />
          <div className="text-sm">
            <p className="font-medium">{t("gdpr.infoBanner.title")}</p>
            <p className="text-muted-foreground">{t("gdpr.infoBanner.description")}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("gdpr.list.title")}</CardTitle>
          <CardDescription>{t("gdpr.list.count", { count: itemCount })}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {listQ.isLoading ? (
            <div className="space-y-3 p-4">
              {SKELETON_IDS.map((id) => (
                <Skeleton key={id} className="h-10 w-full" />
              ))}
            </div>
          ) : listQ.isError ? (
            <div className="p-6 text-sm text-destructive">
              <ErrorText error={listQ.error} />
            </div>
          ) : !listQ.data?.items?.length ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <ScrollTextIcon className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t("gdpr.list.empty")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("gdpr.list.columns.user")}</TableHead>
                  <TableHead>{t("gdpr.list.columns.reason")}</TableHead>
                  <TableHead>{t("gdpr.list.columns.status")}</TableHead>
                  <TableHead>{t("gdpr.list.columns.graceUntil")}</TableHead>
                  <TableHead>{t("gdpr.list.columns.filed")}</TableHead>
                  <TableHead className="text-right">{t("gdpr.list.columns.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQ.data.items.map((r) => {
                  const variant =
                    r.status === "completed"
                      ? "destructive"
                      : r.status === "cancelled"
                        ? "muted"
                        : "warning";
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {r.user_id.slice(0, 16)}…
                      </TableCell>
                      <TableCell
                        className="max-w-md truncate text-muted-foreground"
                        title={r.reason ?? ""}
                      >
                        {r.reason ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={variant}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(r.grace_until).toLocaleDateString(formatLocale())}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString(formatLocale())}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={r.status !== "pending" || cancelM.isPending}
                          onClick={() =>
                            openConfirm({
                              title: t("gdpr.confirm.cancelTitle"),
                              variant: "default",
                              confirmLabel: t("gdpr.confirm.cancelLabel"),
                              onConfirm: () => cancelM.mutate(r.id),
                            })
                          }
                        >
                          {t("gdpr.list.cancelRequest")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreatePurgeSheet open={creating} onOpenChange={setCreating} />
    </div>
  );
}

/** Renders the sheet that files an erasure request, which starts the grace period. */
function CreatePurgeSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {open && <CreatePurgeForm onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function CreatePurgeForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation("compliance");
  const runSensitive = useSensitiveAction();
  const createM = useCreateGdprPurge();
  const schema = useMemo(
    () => z.object({ user_id: z.guid(t("gdpr.create.validation.userId")), reason: z.string() }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { user_id: "", reason: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      await runSensitive({
        actionLabel: t("gdpr.create.submitAction"),
        run: () =>
          createM.mutateAsync({ user_id: value.user_id.trim(), reason: value.reason.trim() }),
      })
        .then((filed) => filed && onDone())
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
        });
    },
  });

  return (
    <form
      className="flex h-full flex-col"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <SheetHeader>
        <SheetTitle>{t("gdpr.create.title")}</SheetTitle>
        <SheetDescription>{t("gdpr.create.description")}</SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup>
          <form.AppField name="user_id">
            {(field) => (
              <field.TextField
                label={t("gdpr.create.userId")}
                description={t("gdpr.create.userIdHelp")}
                placeholder="00000000-0000-0000-0000-000000000000"
                className="font-mono text-xs"
                required
              />
            )}
          </form.AppField>
          <form.AppField name="reason">
            {(field) => (
              <field.TextareaField
                label={t("gdpr.create.reason")}
                description={t("gdpr.create.reasonHelp")}
                placeholder={t("gdpr.create.reasonPlaceholder")}
                rows={4}
              />
            )}
          </form.AppField>
          <FormError error={createM.error} />
        </FieldGroup>
      </div>
      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <SheetClose render={<Button type="button" variant="outline" />}>
          {t("gdpr.create.cancel")}
        </SheetClose>
        <form.AppForm>
          <form.SubmitButton pendingLabel={t("gdpr.create.submitting")}>
            {t("gdpr.create.submit")}
          </form.SubmitButton>
        </form.AppForm>
      </SheetFooter>
    </form>
  );
}
