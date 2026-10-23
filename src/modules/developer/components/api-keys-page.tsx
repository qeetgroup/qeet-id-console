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
import { KeyRoundIcon, PlusIcon, RefreshCwIcon, TrashIcon } from "@qeetrix/icons";
import { useState } from "react";

import { formatLocale } from "@/i18n";
import { localDateTimeToInstant } from "@/shared/utils/format";

import { useCreateIntent } from "@/shared/hooks/use-create-intent";
import { useCapabilities } from "@/platform/security/capability-provider";
import { useTranslation } from "react-i18next";

import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { OneTimeSecret } from "@/shared/components/one-time-secret";
import { PageHeader } from "@/platform/components/page-header";
import { useTenantId } from "@/platform/auth/session";
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from "../api/api-keys";
import { DataState } from "@/platform/components/data-state";
import { StatusPill } from "@/platform/components/status-pill";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import { useMemo } from "react";
import { z } from "zod";

const SKELETON_IDS = ["a", "b", "c"] as const;

/** Renders the tenant's API keys with revoke, and the sheet that creates one. */
export function ApiKeysPage() {
  const { t } = useTranslation("developer");
  const runSensitive = useSensitiveAction();
  // `?action=create` opens this drawer, so the Applications overview can deep-link into it.
  const [creating, setCreating] = useCreateIntent(useCapabilities().can("apikey.write"));
  const [revealed, setRevealed] = useState<{
    name: string;
    secret: string;
  } | null>(null);

  const keysQ = useApiKeys();

  const revokeM = useRevokeApiKey();

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        description={t("keys.description")}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => keysQ.refetch()}
              disabled={keysQ.isFetching}
            >
              <RefreshCwIcon className={keysQ.isFetching ? "animate-spin" : ""} />
              {t("keys.refreshBtn")}
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              <PlusIcon /> {t("keys.newButton")}
            </Button>
          </>
        }
      />

      {revealed?.secret ? (
        <OneTimeSecret
          title={t("keys.revealed.title")}
          description={t("keys.revealed.description", { name: revealed.name })}
          values={[{ value: revealed.secret }]}
          dismissLabel={t("keys.revealed.dismiss")}
          onDismiss={() => setRevealed(null)}
        />
      ) : revealed ? (
        // The key exists but can never be used, so say so rather than offer an empty copy field.
        <Card className="border-destructive/40 bg-destructive/5" role="alert">
          <CardHeader>
            <CardTitle className="text-base">{t("keys.revealed.missingTitle")}</CardTitle>
            <CardDescription>
              {t("keys.revealed.missingDescription", { name: revealed.name })}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setRevealed(null)}>
              {t("keys.revealed.dismiss")}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("keys.list.title")}</CardTitle>
          <CardDescription>
            {t("keys.list.count", { count: keysQ.data?.items?.length ?? 0 })}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataState
            isLoading={keysQ.isLoading}
            isError={keysQ.isError}
            error={keysQ.error}
            isEmpty={!keysQ.data?.items.length}
            skeletonRows={SKELETON_IDS.length}
            empty={
              <div className="flex flex-col items-center gap-2 p-10 text-center">
                <KeyRoundIcon className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t("keys.list.empty")}</p>
              </div>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("keys.columns.name")}</TableHead>
                  <TableHead>{t("keys.columns.prefix")}</TableHead>
                  <TableHead>{t("keys.columns.scopes")}</TableHead>
                  <TableHead>{t("keys.columns.lastUsed")}</TableHead>
                  <TableHead>{t("keys.columns.status")}</TableHead>
                  <TableHead className="text-right">{t("keys.columns.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(keysQ.data?.items ?? []).map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {k.prefix}…
                    </TableCell>
                    <TableCell>
                      {k.scopes?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {k.scopes.map((s) => (
                            <Badge key={s} variant="muted">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {k.last_used_at
                        ? new Date(k.last_used_at).toLocaleString(formatLocale())
                        : t("keys.lastUsedNever")}
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        status={
                          k.revoked_at
                            ? "revoked"
                            : k.expires_at && new Date(k.expires_at) < new Date()
                              ? "expired"
                              : "active"
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!!k.revoked_at || revokeM.isPending}
                        onClick={() =>
                          runSensitive({
                            confirm: {
                              title: t("keys.confirm.title", { name: k.name }),
                              description: t("keys.confirm.description"),
                              confirmLabel: t("keys.confirm.label"),
                              tone: "destructive",
                            },
                            actionLabel: t("keys.stepUp.revoke"),
                            run: () => revokeM.mutateAsync(k.id),
                          }).catch(settleSensitiveAction)
                        }
                      >
                        <TrashIcon /> {t("keys.revokeBtn")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataState>
        </CardContent>
      </Card>

      <CreateApiKeySheet open={creating} onOpenChange={setCreating} onCreated={setRevealed} />
    </div>
  );
}

/** Renders the sheet that creates an API key; the parent shows its secret once. */
function CreateApiKeySheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (key: { name: string; secret: string }) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {open && (
          <CreateApiKeyForm
            onCreated={(key) => {
              onCreated(key);
              onOpenChange(false);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function CreateApiKeyForm({
  onCreated,
}: {
  onCreated: (key: { name: string; secret: string }) => void;
}) {
  const { t } = useTranslation("developer");
  const tenantId = useTenantId();
  const runSensitive = useSensitiveAction();
  const createM = useCreateApiKey();
  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t("keys.create.validation.name"))
          .max(200, t("keys.create.validation.nameTooLong")),
        scopes: z.string(),
        // The input holds a local wall-clock time; the API takes an RFC 3339 instant.
        expires_at: z.string().refine((raw) => {
          if (!raw) return true;
          const instant = localDateTimeToInstant(raw);
          return !!instant && new Date(instant) > new Date();
        }, t("keys.create.expiresPast")),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { name: "", scopes: "", expires_at: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      if (!tenantId) return;
      const scopes = value.scopes.trim();
      await runSensitive({
        actionLabel: t("keys.stepUp.create"),
        run: () =>
          createM.mutateAsync({
            tenant_id: tenantId,
            name: value.name.trim(),
            scopes: scopes ? scopes.split(/\s+/) : undefined,
            expires_at: localDateTimeToInstant(value.expires_at) ?? undefined,
          }),
      })
        .then((res) => res && onCreated({ name: res.api_key.name, secret: res.secret ?? "" }))
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
        <SheetTitle>{t("keys.create.title")}</SheetTitle>
        <SheetDescription>{t("keys.create.description")}</SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup>
          <form.AppField name="name">
            {(field) => (
              <field.TextField
                label={t("keys.create.nameLabel")}
                placeholder={t("apiKeysPage.ciDeployKey")}
                required
              />
            )}
          </form.AppField>
          <form.AppField name="scopes">
            {(field) => (
              <field.TextField
                label={t("keys.create.scopesLabel")}
                description={t("keys.create.scopesHelp")}
                placeholder="user.read tenant.read"
              />
            )}
          </form.AppField>
          <form.AppField name="expires_at">
            {(field) => (
              <field.TextField
                label={t("keys.create.expiresLabel")}
                description={t("keys.create.expiresHelp")}
                type="datetime-local"
              />
            )}
          </form.AppField>
          <FormError error={createM.error} />
        </FieldGroup>
      </div>
      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <SheetClose render={<Button type="button" variant="outline" />}>
          {t("keys.create.cancelBtn")}
        </SheetClose>
        <form.AppForm>
          <form.SubmitButton pendingLabel={t("keys.create.creatingBtn")}>
            {t("keys.create.createBtn")}
          </form.SubmitButton>
        </form.AppForm>
      </SheetFooter>
    </form>
  );
}
