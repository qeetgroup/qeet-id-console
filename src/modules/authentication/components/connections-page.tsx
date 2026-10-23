import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Button,
} from "@qeetrix/ui";
import { KeyRoundIcon, LinkIcon, ShieldCheckIcon, TrashIcon } from "@qeetrix/icons";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { DataState } from "@/platform/components/data-state";
import { PageHeader } from "@/platform/components/page-header";
import {
  applyServerErrors,
  FieldFrame,
  FormError,
  useAppForm,
  useFieldChange,
} from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { OneTimeSecret } from "@/shared/components/one-time-secret";
import { formatDateTime } from "@/shared/utils/format";
import {
  type AdminPortalCapability,
  type AdminPortalLink,
  isAdminPortalLinkActive,
  useAdminPortalLinks,
  useGenerateAdminPortalLink,
  useRevokeAdminPortalLink,
} from "../api/admin-portal";
import { AuthStatusPill } from "./auth-status-pill";

const HOUR = 60 * 60;

// How long a link lives, with its label key; a day is the default.
const TTL_OPTIONS = [
  { seconds: HOUR, label: "connections.portal.ttl1h" },
  { seconds: 24 * HOUR, label: "connections.portal.ttl24h" },
  { seconds: 3 * 24 * HOUR, label: "connections.portal.ttl3d" },
  { seconds: 7 * 24 * HOUR, label: "connections.portal.ttl7d" },
] as const;
const DEFAULT_TTL = String(24 * HOUR);

const CAPABILITIES = [
  { id: "saml", label: "SAML", ariaLabel: "connections.portal.samlCapability" },
  { id: "scim", label: "SCIM", ariaLabel: "connections.portal.scimCapability" },
] as const satisfies readonly { id: AdminPortalCapability; label: string; ariaLabel: string }[];

/** Renders the ways to connect an identity source, and the self-serve admin portal links. */
export function ConnectionsPage() {
  const { t } = useTranslation("auth");
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader description={t("connections.description")} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ConnectionCard
          to="/auth/connections/saml"
          title={t("connections.cards.saml2Title")}
          description={t("connections.cards.saml2Desc")}
        />
        <ConnectionCard
          to="/auth/connections/saml-idp"
          title={t("connections.cards.samlIdpTitle")}
          description={t("connections.cards.samlIdpDesc")}
        />
        <ConnectionCard
          to="/auth/connections/oidc"
          title={t("connections.cards.oidcTitle")}
          description={t("connections.cards.oidcDesc")}
        />
        <ConnectionCard
          to="/auth/connections/scim"
          title={t("connections.cards.scimTitle")}
          description={t("connections.cards.scimDesc")}
        />
      </div>

      <AdminPortalCard />
    </div>
  );
}

function ConnectionCard({
  to,
  title,
  description,
}: {
  to: string;
  title: string;
  description: string;
}) {
  return (
    <Link to={to}>
      <Card className="h-full transition-colors hover:border-primary/50">
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}

/** Renders the admin portal: generate a link (shown once), and the links with revoke. */
function AdminPortalCard() {
  const { t } = useTranslation("auth");
  const runSensitive = useSensitiveAction();
  const linksQ = useAdminPortalLinks();
  const generateM = useGenerateAdminPortalLink();
  const revokeM = useRevokeAdminPortalLink();
  const items = linksQ.data?.items ?? [];
  const generated = generateM.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("connections.portal.title")}</CardTitle>
        <CardDescription>{t("connections.portal.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <GenerateLinkForm generate={generateM} />

        {generated && (
          <OneTimeSecret
            title={t("connections.portal.generatedTitle")}
            description={t("connections.portal.copied")}
            values={[{ value: generated.url }]}
            dismissLabel={t("connections.portal.saved")}
            onDismiss={() => generateM.reset()}
          />
        )}

        <DataState
          isLoading={linksQ.isLoading}
          isError={linksQ.isError}
          error={linksQ.error}
          isEmpty={items.length === 0}
          emptyIcon={ShieldCheckIcon}
          emptyTitle={t("connections.portal.emptyTitle")}
          emptyDescription={t("connections.portal.emptyDescription")}
          skeletonRows={2}
        >
          <ul className="divide-y">
            {items.map((l) => (
              <AdminPortalLinkRow
                key={l.id}
                link={l}
                onRevoke={() =>
                  runSensitive({
                    confirm: {
                      title: t("connections.portal.confirm.title"),
                      description: t("connections.portal.confirm.description"),
                      confirmLabel: t("connections.portal.confirm.label"),
                      tone: "destructive",
                    },
                    actionLabel: t("connections.portal.stepUp.revoke"),
                    run: () => revokeM.mutateAsync(l.id),
                  }).catch(settleSensitiveAction)
                }
                busy={revokeM.isPending}
              />
            ))}
          </ul>
        </DataState>
      </CardContent>
    </Card>
  );
}

function GenerateLinkForm({
  generate,
}: {
  generate: ReturnType<typeof useGenerateAdminPortalLink>;
}) {
  const { t } = useTranslation("auth");
  const runSensitive = useSensitiveAction();
  const schema = useMemo(
    () =>
      z.object({
        capabilities: z
          .array(z.enum(["saml", "scim"]))
          .min(1, t("connections.portal.validation.capabilities")),
        ttl_seconds: z.string(),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: {
      capabilities: ["saml", "scim"] as AdminPortalCapability[],
      ttl_seconds: DEFAULT_TTL,
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      await runSensitive({
        actionLabel: t("connections.portal.stepUp.generate"),
        run: () =>
          generate.mutateAsync({
            capabilities: value.capabilities,
            ttl_seconds: Number(value.ttl_seconds),
          }),
      }).catch((err: unknown) => {
        applyServerErrors(formApi, err);
        settleSensitiveAction(err);
      });
    },
  });

  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <form.AppField name="capabilities">
          {(field) => (
            <FieldFrame label={t("connections.portal.capabilities")}>
              <CapabilityChoices selected={field.state.value} />
            </FieldFrame>
          )}
        </form.AppField>
        <div className="sm:w-40">
          <form.AppField name="ttl_seconds">
            {(field) => (
              <field.SelectField
                label={t("connections.portal.expires")}
                options={TTL_OPTIONS.map((o) => ({ value: String(o.seconds), label: t(o.label) }))}
              />
            )}
          </form.AppField>
        </div>
        <form.AppForm>
          <form.SubmitButton icon={<LinkIcon />}>
            {t("connections.portal.generate")}
          </form.SubmitButton>
        </form.AppForm>
      </div>
      <FormError error={generate.error} />
    </form>
  );
}

// The capability checkboxes, bound to the enclosing form field as one list. A @base-ui Checkbox is
// a custom element, so label/htmlFor doesn't apply: it takes an aria-label, beside visible text.
function CapabilityChoices({ selected }: { selected: AdminPortalCapability[] }) {
  const { t } = useTranslation("auth");
  const change = useFieldChange<AdminPortalCapability[]>();
  return (
    <div className="flex items-center gap-4 pt-1">
      {CAPABILITIES.map((c) => (
        <div key={c.id} className="flex items-center gap-2 text-sm">
          <Checkbox
            aria-label={t(c.ariaLabel)}
            checked={selected.includes(c.id)}
            onCheckedChange={(on) =>
              change(on === true ? [...selected, c.id] : selected.filter((id) => id !== c.id))
            }
          />
          <span aria-hidden>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

function AdminPortalLinkRow({
  link: l,
  onRevoke,
  busy,
}: {
  link: AdminPortalLink;
  onRevoke: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation("auth");
  const active = isAdminPortalLinkActive(l);
  const status = l.revoked_at ? "revoked" : active ? "active" : "expired";

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium">
          <KeyRoundIcon className="size-4 text-muted-foreground" />
          {l.capabilities.join(" + ")}
          <AuthStatusPill status={status} />
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {t("connections.portal.linkExpires", { date: formatDateTime(l.expires_at) })}
          {l.last_used_at
            ? t("connections.portal.linkLastUsed", { date: formatDateTime(l.last_used_at) })
            : t("connections.portal.linkNeverUsed")}
        </p>
      </div>
      {active && (
        <Button variant="ghost" size="sm" disabled={busy} onClick={onRevoke}>
          <TrashIcon /> {t("connections.portal.revokeBtn")}
        </Button>
      )}
    </li>
  );
}
