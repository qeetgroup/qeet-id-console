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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { DataState } from "@/platform/components/data-state";
import {
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  PlusIcon,
  RefreshCwIcon,
  TrashIcon,
} from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";
import { toastError } from "@/platform/errors/error-toast";
import {
  SensitiveActionCancelled,
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { OneTimeSecret } from "@/shared/components/one-time-secret";
import {
  type Secret,
  useCreateSecret,
  useDeleteSecret,
  useRevealSecret,
  useRotateSecret,
  useSecrets,
} from "../api/secrets";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import { useMemo } from "react";
import { z } from "zod";

/** Renders the tenant's secrets, masked, with reveal, rotate, delete and create. */
export function SecretsPage() {
  const { t } = useTranslation("auth");
  const runSensitive = useSensitiveAction();
  const listQ = useSecrets();
  const revealM = useRevealSecret();
  const deleteM = useDeleteSecret();
  const [creating, setCreating] = useState(false);
  const [rotating, setRotating] = useState<{ id: string; name: string } | null>(null);
  const [revealed, setRevealed] = useState<{ id: string; name: string; value: string } | null>(
    null,
  );

  const items = listQ.data?.items ?? [];

  const toggleReveal = (secret: Secret) => {
    if (revealed?.id === secret.id) {
      setRevealed(null);
      return;
    }
    runSensitive({
      actionLabel: t("secrets.stepUp.reveal"),
      run: () => revealM.mutateAsync(secret.id),
    })
      .then((d) => {
        if (d) setRevealed({ id: secret.id, name: secret.name, value: d.value });
      })
      .catch((err) => {
        settleSensitiveAction(err);
        // The reveal mutation is silent, so the query client never reports its failure.
        if (!(err instanceof SensitiveActionCancelled)) toastError(err);
      });
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        description={t("secrets.description")}
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <PlusIcon className="mr-2 size-4" />
            {t("secrets.newButton")}
          </Button>
        }
      />

      {revealed && (
        <OneTimeSecret
          title={t("secrets.revealed.title", { name: revealed.name })}
          description={t("secrets.revealed.description")}
          values={[{ value: revealed.value }]}
          dismissLabel={t("secrets.hide")}
          onDismiss={() => setRevealed(null)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("secrets.list.title")}</CardTitle>
          <CardDescription>{t("secrets.list.count", { count: items.length })}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataState
            isLoading={listQ.isLoading}
            isError={listQ.isError}
            error={listQ.error}
            isEmpty={items.length === 0}
            emptyIcon={KeyRoundIcon}
            emptyTitle={t("secrets.list.empty")}
            skeletonRows={3}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("secrets.columns.name")}</TableHead>
                  <TableHead>{t("secrets.columns.scope")}</TableHead>
                  <TableHead>{t("secrets.columns.value")}</TableHead>
                  <TableHead>{t("secrets.columns.updated")}</TableHead>
                  <TableHead className="text-right">{t("secrets.columns.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((s) => {
                  const shown = revealed?.id === s.id;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.name}</TableCell>
                      <TableCell>
                        {s.scope ? <Badge variant="outline">{s.scope}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {s.last4 ? `••••••••${s.last4}` : "••••••••"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <TimeSince value={s.updated_at} />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleReveal(s)}
                          disabled={revealM.isPending}
                        >
                          {shown ? <EyeOffIcon /> : <EyeIcon />}
                          {shown ? t("secrets.hide") : t("secrets.reveal")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRotating({ id: s.id, name: s.name })}
                        >
                          <RefreshCwIcon /> {t("secrets.rotate")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            runSensitive({
                              confirm: {
                                title: t("secrets.confirm.title", { name: s.name }),
                                description: t("secrets.confirm.description"),
                                confirmLabel: t("secrets.confirm.label"),
                                tone: "destructive",
                              },
                              actionLabel: t("secrets.stepUp.delete"),
                              run: () => deleteM.mutateAsync(s.id),
                            })
                              .then(() => setRevealed((r) => (r?.id === s.id ? null : r)))
                              .catch(settleSensitiveAction)
                          }
                          disabled={deleteM.isPending}
                        >
                          <TrashIcon /> {t("secrets.deleteBtn")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </DataState>
        </CardContent>
      </Card>

      <CreateSecretSheet open={creating} onOpenChange={setCreating} />
      <RotateSecretSheet target={rotating} onClose={() => setRotating(null)} />
    </div>
  );
}

/** Renders the sheet that replaces a secret's value. */
function RotateSecretSheet({
  target,
  onClose,
}: {
  target: { id: string; name: string } | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {target && <RotateSecretForm key={target.id} target={target} onDone={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function RotateSecretForm({
  target,
  onDone,
}: {
  target: { id: string; name: string };
  onDone: () => void;
}) {
  const { t } = useTranslation("auth");
  const rotateM = useRotateSecret();
  const runSensitive = useSensitiveAction();
  const schema = useMemo(
    () => z.object({ value: z.string().trim().min(1, t("secrets.validation.value")) }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { value: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      await runSensitive({
        actionLabel: t("secrets.stepUp.rotate"),
        run: () => rotateM.mutateAsync({ id: target.id, value: value.value.trim() }),
      })
        .then(onDone)
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
        <SheetTitle>{t("secrets.rotateSheet.title", { name: target.name })}</SheetTitle>
        <SheetDescription>{t("secrets.rotateSheet.description")}</SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup>
          <form.AppField name="value">
            {(field) => (
              <field.PasswordField
                label={t("secrets.rotateSheet.valueLabel")}
                description={t("secrets.rotateSheet.valueHelp")}
                placeholder="sk_live_…"
                className="font-mono"
                autoComplete="off"
                required
              />
            )}
          </form.AppField>
          <FormError error={rotateM.error} />
        </FieldGroup>
      </div>
      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <SheetClose render={<Button type="button" variant="outline" />}>
          {t("secrets.rotateSheet.cancelBtn")}
        </SheetClose>
        <form.AppForm>
          <form.SubmitButton pendingLabel={t("secrets.rotateSheet.savingBtn")}>
            {t("secrets.rotateSheet.submitBtn")}
          </form.SubmitButton>
        </form.AppForm>
      </SheetFooter>
    </form>
  );
}

/** Renders the sheet that stores a new secret. */
function CreateSecretSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {open && <CreateSecretForm onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function CreateSecretForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation("auth");
  const runSensitive = useSensitiveAction();
  const createM = useCreateSecret();
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("secrets.validation.name")),
        scope: z.string(),
        value: z.string().min(1, t("secrets.validation.value")),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { name: "", scope: "", value: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      await runSensitive({
        actionLabel: t("secrets.stepUp.create"),
        run: () =>
          createM.mutateAsync({
            name: value.name.trim(),
            scope: value.scope.trim(),
            value: value.value,
          }),
      })
        .then(onDone)
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
        <SheetTitle>{t("secrets.create.title")}</SheetTitle>
        <SheetDescription>{t("secrets.create.description")}</SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup>
          <form.AppField name="name">
            {(field) => (
              <field.TextField
                label={t("secrets.create.nameLabel")}
                placeholder="stripe.api_key"
                className="font-mono"
                required
              />
            )}
          </form.AppField>
          <form.AppField name="scope">
            {(field) => (
              <field.TextField
                label={t("secrets.create.scopeLabel")}
                description={t("secrets.create.scopeHelp")}
                placeholder={t("secretsPage.billingOptional")}
              />
            )}
          </form.AppField>
          <form.AppField name="value">
            {(field) => (
              <field.PasswordField
                label={t("secrets.create.valueLabel")}
                placeholder="sk_live_…"
                className="font-mono"
                autoComplete="off"
                required
              />
            )}
          </form.AppField>
          <FormError error={createM.error} />
        </FieldGroup>
      </div>
      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <SheetClose render={<Button type="button" variant="outline" />}>
          {t("secrets.create.cancelBtn")}
        </SheetClose>
        <form.AppForm>
          <form.SubmitButton pendingLabel={t("secrets.create.savingBtn")}>
            {t("secrets.create.createBtn")}
          </form.SubmitButton>
        </form.AppForm>
      </SheetFooter>
    </form>
  );
}
