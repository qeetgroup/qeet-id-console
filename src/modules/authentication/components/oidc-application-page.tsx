import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FieldGroup,
  TimeSince,
} from "@qeetrix/ui";
import { DataState } from "@/platform/components/data-state";
import { StatusPill } from "@/platform/components/status-pill";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  ImageOffIcon,
  KeySquareIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  TrashIcon,
} from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { OidcQuickstart } from "./oidc-quickstart";
import { ProofKeyCard } from "./proof-key-status";
import { SecretFailuresCard } from "./secret-failures-card";
import { OneTimeSecret } from "@/shared/components/one-time-secret";
import {
  type OidcClient,
  useDeleteOidcClient,
  useOidcClients,
  useRotateClientSecret,
  useUpdateOidcClient,
} from "../api/oidc-clients";
import {
  applicationHomePage,
  applicationLogo,
  presentationUriField,
} from "../application-presentation-model";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import { useMemo } from "react";
import { z } from "zod";

/** Split a comma / whitespace / newline separated textarea into a clean list. */
function splitList(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Renders one application, found by client id or row id: edit, secret, proof key and delete. */
export function OidcApplicationPage({ clientId }: { clientId: string }) {
  const { t } = useTranslation("oidc");
  const listQ = useOidcClients();
  const client = listQ.data?.items?.find((c) => c.client_id === clientId || c.id === clientId);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div>
        <Link
          to="/auth/connections/oidc"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" /> {t("detail.backToList")}
        </Link>
      </div>

      <DataState
        isLoading={listQ.isLoading}
        isError={listQ.isError}
        error={listQ.error}
        isEmpty={listQ.isSuccess && !client}
        emptyIcon={KeySquareIcon}
        emptyTitle={t("detail.notFoundTitle", { clientId })}
        emptyDescription={t("detail.notFoundDescription")}
      >
        {client && <OidcClientDetail client={client} />}
      </DataState>
    </div>
  );
}

function OidcClientDetail({ client }: { client: OidcClient }) {
  const { t } = useTranslation(["oidc", "common"]);
  const navigate = useNavigate();
  const rotateM = useRotateClientSecret(client.id);
  const deleteM = useDeleteOidcClient();
  const runSensitive = useSensitiveAction();
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);
  const logo = applicationLogo(client.logo_uri);
  const homePage = applicationHomePage(client.client_uri);

  // Rotating the client secret invalidates the old one immediately — confirm +
  // step-up before minting a new secret.
  const rotateSecret = () =>
    runSensitive({
      confirm: {
        title: t("detail.rotateConfirm.title"),
        description: t("detail.rotateConfirm.description"),
        confirmLabel: t("detail.rotateConfirm.label"),
        tone: "destructive",
      },
      actionLabel: t("detail.stepUp.rotate"),
      run: () => rotateM.mutateAsync(undefined),
    })
      .then((res) => {
        if (res) setRotatedSecret(res.client_secret);
      })
      .catch(settleSensitiveAction);

  const deleteClient = () =>
    runSensitive({
      confirm: {
        title: t("detail.deleteTitle"),
        description: t("detail.deleteConfirmDescription", { name: client.name }),
        confirmLabel: t("common:actions.delete"),
        tone: "destructive",
      },
      actionLabel: t("detail.stepUp.delete"),
      run: () => deleteM.mutateAsync(client.id),
    })
      .then(() => navigate({ to: "/auth/connections/oidc" }))
      .catch(settleSensitiveAction);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          {/* The logo and home page's host, as the hosted sign-in page shows them. */}
          <div className="flex min-w-0 items-start gap-3">
            {logo && (
              <Avatar className="size-10 shrink-0 rounded-lg border bg-background">
                <AvatarImage
                  src={logo}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="object-contain p-1"
                />
                <AvatarFallback delay={600} className="rounded-lg">
                  <ImageOffIcon aria-hidden="true" />
                  <span className="sr-only">{t("presentation.logoUnavailable")}</span>
                </AvatarFallback>
              </Avatar>
            )}
            <div className="min-w-0">
              <CardTitle className="text-xl">{client.name}</CardTitle>
              <CardDescription className="font-mono">{client.client_id}</CardDescription>
              {homePage && (
                <a
                  href={homePage.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  <span className="truncate">{homePage.host}</span>
                  <ExternalLinkIcon className="size-3 shrink-0" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
          <StatusPill kind={client.type === "confidential" ? "info" : "muted"}>
            {client.type === "confidential"
              ? t("filters.typeConfidential")
              : t("filters.typePublic")}
          </StatusPill>
        </CardHeader>
        <CardContent>
          <OidcClientEditForm client={client} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("detail.metadataTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">{t("detail.createdLabel")}</p>
              <TimeSince value={client.created_at} className="font-mono text-xs" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("detail.rowIdLabel")}</p>
              <p className="font-mono text-xs break-all">{client.id}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("detail.tenantLabel")}</p>
              <p className="font-mono text-xs break-all">{client.tenant_id}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("detail.grantTypesLabel")}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {client.grant_types.map((g) => (
                  <Badge key={g} variant="secondary">
                    {g}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <ProofKeyCard client={client} />

        <SecretFailuresCard client={client} />

        {client.type === "confidential" &&
          (rotatedSecret ? (
            <OneTimeSecret
              title={t("detail.secretTitle")}
              description={t("detail.secretCopyHint")}
              values={[{ label: "client_secret=", value: rotatedSecret }]}
              dismissLabel={t("common:actions.dismiss")}
              onDismiss={() => setRotatedSecret(null)}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("detail.secretTitle")}</CardTitle>
                <CardDescription>{t("detail.secretDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={rotateM.isPending}
                  onClick={rotateSecret}
                >
                  {rotateM.isPending ? (
                    <LoaderCircleIcon className="animate-spin" />
                  ) : (
                    <RefreshCwIcon />
                  )}
                  {t("detail.rotateSecret")}
                </Button>
              </CardContent>
            </Card>
          ))}

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base">{t("detail.dangerZoneTitle")}</CardTitle>
            <CardDescription>{t("detail.dangerZoneDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              size="sm"
              onClick={deleteClient}
              disabled={deleteM.isPending}
            >
              <TrashIcon /> {t("detail.deleteApplication")}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-3">
        <OidcQuickstart client={client} />
      </div>
    </div>
  );
}

function editValues(client: OidcClient) {
  return {
    name: client.name,
    redirect_uris: client.redirect_uris.join("\n"),
    post_logout_uris: (client.post_logout_uris ?? []).join("\n"),
    grant_types: client.grant_types.join(" "),
    scopes: client.scopes.join(" "),
    logo_uri: client.logo_uri ?? "",
    client_uri: client.client_uri ?? "",
  };
}

/** Renders the form that edits an application's name, URIs, grants, scopes, logo and home page. */
function OidcClientEditForm({ client }: { client: OidcClient }) {
  const { t } = useTranslation(["oidc", "common"]);
  const runSensitive = useSensitiveAction();
  const updateM = useUpdateOidcClient(client.id);
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("detail.validation.name")),
        redirect_uris: z.string(),
        post_logout_uris: z.string(),
        grant_types: z.string(),
        scopes: z.string(),
        logo_uri: presentationUriField,
        client_uri: presentationUriField,
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: editValues(client),
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      const body = {
        name: value.name.trim(),
        redirect_uris: splitList(value.redirect_uris),
        post_logout_uris: splitList(value.post_logout_uris),
        grant_types: splitList(value.grant_types),
        scopes: splitList(value.scopes),
        logo_uri: value.logo_uri.trim(), // "" clears it
        client_uri: value.client_uri.trim(),
      };
      await runSensitive({
        actionLabel: t("detail.stepUp.update"),
        run: () => updateM.mutateAsync(body),
      })
        .then((saved) => saved && formApi.reset(value))
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
        });
    },
  });

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.AppField name="name">
          {(field) => <field.TextField label={t("detail.name")} required />}
        </form.AppField>
        <form.AppField name="redirect_uris">
          {(field) => (
            <field.TextareaField
              label={t("detail.redirectUris")}
              description={t("detail.redirectUrisHelp")}
              rows={3}
              className="font-mono text-xs"
            />
          )}
        </form.AppField>
        <form.AppField name="post_logout_uris">
          {(field) => (
            <field.TextareaField
              label={t("detail.postLogoutUris")}
              rows={2}
              className="font-mono text-xs"
            />
          )}
        </form.AppField>
        <form.AppField name="grant_types">
          {(field) => (
            <field.TextField
              label={t("detail.grantTypes")}
              description={t("detail.grantTypesHelp")}
            />
          )}
        </form.AppField>
        <form.AppField name="scopes">
          {(field) => (
            <field.TextField label={t("detail.scopes")} description={t("detail.scopesHelp")} />
          )}
        </form.AppField>
        <form.AppField name="logo_uri">
          {(field) => (
            <field.TextField
              type="url"
              label={t("presentation.logoUri")}
              description={t("presentation.logoUriHelp")}
              autoComplete="off"
              spellCheck={false}
              className="font-mono text-xs"
            />
          )}
        </form.AppField>
        <form.AppField name="client_uri">
          {(field) => (
            <field.TextField
              type="url"
              label={t("presentation.clientUri")}
              description={t("presentation.clientUriHelp")}
              autoComplete="off"
              spellCheck={false}
              className="font-mono text-xs"
            />
          )}
        </form.AppField>
        <FormError error={updateM.error} />
      </FieldGroup>
      <div className="flex justify-end">
        <form.AppForm>
          <form.SubmitButton requireChanges pendingLabel={t("common:actions.saving")}>
            {t("common:actions.saveChanges")}
          </form.SubmitButton>
        </form.AppForm>
      </div>
    </form>
  );
}
