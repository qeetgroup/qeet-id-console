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
} from "@qeetrix/ui";
import { BotIcon, PlusIcon, RefreshCwIcon, TrashIcon } from "@qeetrix/icons";
import { useState } from "react";

import { formatLocale } from "@/i18n";
import { useCreateIntent } from "@/shared/hooks/use-create-intent";
import { useTranslation } from "react-i18next";

import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { OneTimeSecret } from "@/shared/components/one-time-secret";
import { PageHeader } from "@/platform/components/page-header";
import type { CreatedServicePrincipal } from "../api/service-principals";
import { useTenantId } from "@/platform/auth/session";
import {
  useCreateServicePrincipal,
  useDisableServicePrincipal,
  useServicePrincipals,
} from "../api/service-principals";
import { DataState } from "@/platform/components/data-state";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import { useMemo } from "react";
import { z } from "zod";

/** Renders the tenant's machine identities with disable, and the sheet that creates one. */
export function MachineIdentitiesPage() {
  const { t } = useTranslation("developer");
  const runSensitive = useSensitiveAction();
  const [creating, setCreating] = useCreateIntent(true); // `?action=create` deep-links here
  const [revealed, setRevealed] = useState<CreatedServicePrincipal | null>(null);

  const listQ = useServicePrincipals();
  const disableM = useDisableServicePrincipal();

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        description={t("machineIds.description")}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => listQ.refetch()}
              disabled={listQ.isFetching}
            >
              <RefreshCwIcon className={listQ.isFetching ? "animate-spin" : ""} />
              {t("machineIds.refreshBtn")}
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              <PlusIcon /> {t("machineIds.newButton")}
            </Button>
          </>
        }
      />

      {revealed && (
        <OneTimeSecret
          title={t("machineIds.revealed.title", { name: revealed.service_principal.name })}
          description={t("machineIds.revealed.description")}
          values={[
            { label: "client_id=", value: revealed.client_id },
            { label: "client_secret=", value: revealed.client_secret },
          ]}
          dismissLabel={t("machineIds.revealed.dismiss")}
          onDismiss={() => setRevealed(null)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("machineIds.list.title")}</CardTitle>
          <CardDescription>
            {t("machineIds.list.count", {
              count: listQ.data?.items?.length ?? 0,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataState
            isLoading={listQ.isLoading}
            isError={listQ.isError}
            error={listQ.error}
            isEmpty={!listQ.data?.items?.length}
            skeletonRows={3}
            empty={
              <div className="flex flex-col items-center gap-2 p-10 text-center">
                <BotIcon className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t("machineIds.list.empty")}</p>
              </div>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("machineIds.columns.name")}</TableHead>
                  <TableHead>{t("machineIds.columns.clientId")}</TableHead>
                  <TableHead>{t("machineIds.columns.scopes")}</TableHead>
                  <TableHead>{t("machineIds.columns.status")}</TableHead>
                  <TableHead>{t("machineIds.columns.created")}</TableHead>
                  <TableHead className="text-right">{t("machineIds.columns.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(listQ.data?.items ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.id.slice(0, 16)}…
                    </TableCell>
                    <TableCell>
                      {p.scopes?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {p.scopes.map((s) => (
                            <Badge key={s} variant="muted">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.disabled_at ? (
                        <Badge variant="destructive">{t("machineIds.status.disabled")}</Badge>
                      ) : (
                        <Badge variant="success">{t("machineIds.status.active")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString(formatLocale())}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!!p.disabled_at || disableM.isPending}
                        onClick={() =>
                          runSensitive({
                            confirm: {
                              title: t("machineIds.confirm.title", { name: p.name }),
                              description: t("machineIds.confirm.description"),
                              confirmLabel: t("machineIds.confirm.label"),
                              tone: "destructive",
                            },
                            actionLabel: t("machineIds.stepUp.disable"),
                            run: () => disableM.mutateAsync(p.id),
                          }).catch(settleSensitiveAction)
                        }
                      >
                        <TrashIcon /> {t("machineIds.disableBtn")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataState>
        </CardContent>
      </Card>

      <CreatePrincipalSheet open={creating} onOpenChange={setCreating} onCreated={setRevealed} />
    </div>
  );
}

/** Renders the sheet that creates a machine identity; the parent shows its secret once. */
function CreatePrincipalSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (created: CreatedServicePrincipal) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {open && (
          <CreatePrincipalForm
            onCreated={(created) => {
              onCreated(created);
              onOpenChange(false);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function CreatePrincipalForm({
  onCreated,
}: {
  onCreated: (created: CreatedServicePrincipal) => void;
}) {
  const { t } = useTranslation("developer");
  const tenantId = useTenantId();
  const runSensitive = useSensitiveAction();
  const createM = useCreateServicePrincipal();
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("machineIds.create.validation.name")),
        description: z.string(),
        scopes: z.string(),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { name: "", description: "", scopes: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      if (!tenantId) return;
      const scopes = value.scopes.trim();
      await runSensitive({
        actionLabel: t("machineIds.stepUp.create"),
        run: () =>
          createM.mutateAsync({
            tenant_id: tenantId,
            name: value.name.trim(),
            description: value.description.trim() || undefined,
            scopes: scopes ? scopes.split(/\s+/) : undefined,
          }),
      })
        .then((created) => created && onCreated(created))
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
        <SheetTitle>{t("machineIds.create.title")}</SheetTitle>
        <SheetDescription>{t("machineIds.create.description")}</SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup>
          <form.AppField name="name">
            {(field) => (
              <field.TextField
                label={t("machineIds.create.nameLabel")}
                placeholder="build-bot"
                required
              />
            )}
          </form.AppField>
          <form.AppField name="description">
            {(field) => (
              <field.TextareaField
                label={t("machineIds.create.descriptionLabel")}
                placeholder={t("machineIds.create.descriptionPlaceholder")}
                rows={3}
              />
            )}
          </form.AppField>
          <form.AppField name="scopes">
            {(field) => (
              <field.TextField
                label={t("machineIds.create.scopesLabel")}
                placeholder="user.read tenant.read"
              />
            )}
          </form.AppField>
          <FormError error={createM.error} />
        </FieldGroup>
      </div>
      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <SheetClose render={<Button type="button" variant="outline" />}>
          {t("machineIds.create.cancelBtn")}
        </SheetClose>
        <form.AppForm>
          <form.SubmitButton pendingLabel={t("machineIds.create.creatingBtn")}>
            {t("machineIds.create.createBtn")}
          </form.SubmitButton>
        </form.AppForm>
      </SheetFooter>
    </form>
  );
}
