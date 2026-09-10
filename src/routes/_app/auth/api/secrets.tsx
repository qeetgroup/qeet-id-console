import { Add, Copy, Eye, EyeSlash, Key, RefreshArrow, TickCircle, Trash } from "@qeetrix/icons";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataState,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
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
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";
import { normalizeError } from "@/platform/errors/normalize-error";
import { userMessageForCode } from "@/platform/errors/user-message";
import {
  SensitiveActionCancelled,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import {
  useCreateSecret,
  useDeleteSecret,
  useRevealSecret,
  useRotateSecret,
  useSecrets,
} from "@/modules/developer/api/secrets";

export const Route = createFileRoute("/_app/auth/api/secrets")({
  component: SecretsPage,
});

function SecretsPage() {
  const { t } = useTranslation("auth");
  const runSensitive = useSensitiveAction();
  const listQ = useSecrets();
  const revealM = useRevealSecret();
  const deleteM = useDeleteSecret();

  // Cancellation of the confirm/step-up dialog is expected — swallow it.
  const ignoreCancel = (e: unknown) => {
    if (!(e instanceof SensitiveActionCancelled)) throw e;
  };
  const [creating, setCreating] = useState(false);
  const [rotating, setRotating] = useState<{ id: string; name: string } | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const items = listQ.data?.items ?? [];

  const toggleReveal = (id: string) => {
    if (revealed[id] !== undefined) {
      setRevealed((r) => {
        const next = { ...r };
        delete next[id];
        return next;
      });
      return;
    }
    revealM.mutate(id, {
      onSuccess: (d) => setRevealed((r) => ({ ...r, [id]: d.value })),
    });
  };

  const copy = (id: string, value: string) => {
    void navigator.clipboard?.writeText(value);
    setCopied(id);
    window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        description={t("secrets.description")}
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Add className="mr-2 size-4" />
            {t("secrets.newButton")}
          </Button>
        }
      />

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
            emptyIcon={Key}
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
                  const shown = revealed[s.id];
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.name}</TableCell>
                      <TableCell>
                        {s.scope ? <Badge variant="outline">{s.scope}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {shown !== undefined ? (
                          <span className="flex items-center gap-2">
                            <span className="max-w-55 truncate">{shown}</span>
                            <button
                              type="button"
                              onClick={() => copy(s.id, shown)}
                              className="text-muted-foreground hover:text-foreground"
                              aria-label={t("secrets.copyAriaLabel")}
                            >
                              {copied === s.id ? (
                                <TickCircle className="size-3.5" />
                              ) : (
                                <Copy className="size-3.5" />
                              )}
                            </button>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            {s.last4 ? `••••••••${s.last4}` : "••••••••"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <TimeSince value={s.updated_at} />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleReveal(s.id)}
                          disabled={revealM.isPending}
                        >
                          {shown !== undefined ? <EyeSlash /> : <Eye />}
                          {shown !== undefined ? t("secrets.hide") : t("secrets.reveal")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRotating({ id: s.id, name: s.name })}
                        >
                          <RefreshArrow /> {t("secrets.rotate")}
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
                              actionLabel: "delete this secret",
                              run: () => deleteM.mutateAsync(s.id),
                            }).catch(ignoreCancel)
                          }
                          disabled={deleteM.isPending}
                        >
                          <Trash /> {t("secrets.deleteBtn")}
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
      <RotateSecretSheet
        target={rotating}
        onClose={() => setRotating(null)}
        onIgnoreCancel={ignoreCancel}
      />
    </div>
  );
}

function RotateSecretSheet({
  target,
  onClose,
  onIgnoreCancel,
}: {
  target: { id: string; name: string } | null;
  onClose: () => void;
  onIgnoreCancel: (e: unknown) => void;
}) {
  const { t } = useTranslation("auth");
  const rotateM = useRotateSecret();
  const runSensitive = useSensitiveAction();
  return (
    <Sheet open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <form
          className="flex h-full flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (!target) return;
            const value = String(new FormData(e.currentTarget).get("value") ?? "").trim();
            if (!value) return;
            // Route through the sensitive-action pipeline so a backend
            // step_up_required opens the re-auth dialog and retries the rotation.
            runSensitive({
              actionLabel: "rotate this secret",
              run: () => rotateM.mutateAsync({ id: target.id, value }),
            })
              .then(() => onClose())
              .catch(onIgnoreCancel);
          }}
        >
          <SheetHeader>
            <SheetTitle>{t("secrets.rotateSheet.title", { name: target?.name ?? "" })}</SheetTitle>
            <SheetDescription>{t("secrets.rotateSheet.description")}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="rotate-value">
                  {t("secrets.rotateSheet.valueLabel")}
                </FieldLabel>
                <Input
                  id="rotate-value"
                  name="value"
                  type="password"
                  placeholder="sk_live_…"
                  className="font-mono"
                  autoComplete="off"
                  required
                />
                <FieldDescription>{t("secrets.rotateSheet.valueHelp")}</FieldDescription>
              </Field>
              {rotateM.error && (
                <Field>
                  <FieldError>
                    {userMessageForCode(
                      normalizeError(rotateM.error).code,
                      normalizeError(rotateM.error).kind,
                    )}
                  </FieldError>
                </Field>
              )}
            </FieldGroup>
          </div>
          <SheetFooter className="flex-row justify-end gap-2 border-t">
            <SheetClose render={<Button type="button" variant="outline" />}>
              {t("secrets.rotateSheet.cancelBtn")}
            </SheetClose>
            <Button type="submit" disabled={rotateM.isPending}>
              {rotateM.isPending && <RefreshArrow className="animate-spin" />}
              {rotateM.isPending
                ? t("secrets.rotateSheet.savingBtn")
                : t("secrets.rotateSheet.submitBtn")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function CreateSecretSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation("auth");
  const createM = useCreateSecret();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <form
          className="flex h-full flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            createM.mutate(
              {
                name: String(data.get("name") ?? "").trim(),
                scope: String(data.get("scope") ?? "").trim(),
                value: String(data.get("value") ?? ""),
              },
              { onSuccess: () => onOpenChange(false) },
            );
          }}
        >
          <SheetHeader>
            <SheetTitle>{t("secrets.create.title")}</SheetTitle>
            <SheetDescription>{t("secrets.create.description")}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="secret-name">{t("secrets.create.nameLabel")}</FieldLabel>
                <Input
                  id="secret-name"
                  name="name"
                  placeholder="stripe.api_key"
                  className="font-mono"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="secret-scope">{t("secrets.create.scopeLabel")}</FieldLabel>
                <Input id="secret-scope" name="scope" placeholder="billing (optional)" />
                <FieldDescription>{t("secrets.create.scopeHelp")}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="secret-value">{t("secrets.create.valueLabel")}</FieldLabel>
                <Input
                  id="secret-value"
                  name="value"
                  type="password"
                  placeholder="sk_live_…"
                  className="font-mono"
                  required
                />
              </Field>
              {createM.error && (
                <Field>
                  <FieldError>
                    {userMessageForCode(
                      normalizeError(createM.error).code,
                      normalizeError(createM.error).kind,
                    )}
                  </FieldError>
                </Field>
              )}
            </FieldGroup>
          </div>
          <SheetFooter className="flex-row justify-end gap-2 border-t">
            <SheetClose render={<Button type="button" variant="outline" />}>
              {t("secrets.create.cancelBtn")}
            </SheetClose>
            <Button type="submit" disabled={createM.isPending}>
              {createM.isPending && <RefreshArrow className="animate-spin" />}
              {createM.isPending ? t("secrets.create.savingBtn") : t("secrets.create.createBtn")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
