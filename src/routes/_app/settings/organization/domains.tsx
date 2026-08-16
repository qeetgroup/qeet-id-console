import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CopyableSecret,
  DataState,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@qeetrix/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CheckCircle2Icon,
  CheckIcon,
  ConstructionIcon,
  GlobeIcon,
  Loader2Icon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useConfirmDialog } from "@/shared/components/confirm-dialog";
import { PageHeader } from "@/platform/components/page-header";
import { FeatureGate } from "@/modules/billing/components/upgrade-gate";
import { type ApiError, api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import {
  type TenantDomain,
  useAddDomain,
  useDomains,
  useRemoveDomain,
  useVerifyDomain,
} from "@/modules/organizations/api/domains";

export const Route = createFileRoute("/_app/settings/organization/domains")({
  component: DomainsPage,
});

// Domain ownership verification and the (paid) custom login domain are two
// distinct features that both concern "domains", so they share one page split
// into tabs rather than two scattered sidebar entries.
function DomainsPage() {
  const { t } = useTranslation("settings");

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader description={t("workspace.domains.overview")} />
      <Tabs defaultValue="verified" className="flex min-w-0 flex-col gap-4">
        <TabsList>
          <TabsTrigger value="verified">{t("workspace.domains.tabs.verified")}</TabsTrigger>
          <TabsTrigger value="custom">{t("workspace.domains.tabs.custom")}</TabsTrigger>
        </TabsList>
        <TabsContent value="verified" className="flex min-w-0 flex-col gap-4">
          <VerifiedDomainsPanel />
        </TabsContent>
        <TabsContent value="custom" className="flex min-w-0 flex-col gap-4">
          <CustomLoginDomainPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VerifiedDomainsPanel() {
  const { t } = useTranslation("organizations");
  const domainsQ = useDomains();
  const addM = useAddDomain();
  const [newDomain, setNewDomain] = useState("");
  const items = domainsQ.data?.items ?? [];

  return (
    <>
      <p className="text-sm text-muted-foreground">{t("domains.description")}</p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("domains.addCard.title")}</CardTitle>
          <CardDescription>{t("domains.addCard.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newDomain.trim())
                addM.mutate(newDomain.trim(), {
                  onSuccess: () => setNewDomain(""),
                });
            }}
          >
            <Field className="flex-1">
              <FieldLabel htmlFor="domain">{t("domains.addCard.label")}</FieldLabel>
              <Input
                id="domain"
                placeholder="acme.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
              />
            </Field>
            <Button type="submit" disabled={addM.isPending || !newDomain.trim()}>
              {addM.isPending && <Loader2Icon className="animate-spin" />}
              {t("domains.addCard.submit")}
            </Button>
          </form>
          {addM.error && (
            <p className="mt-2 text-destructive text-sm">{(addM.error as ApiError).message}</p>
          )}
        </CardContent>
      </Card>

      <DataState
        isLoading={domainsQ.isLoading}
        isError={domainsQ.isError}
        error={domainsQ.error}
        isEmpty={items.length === 0}
        emptyIcon={GlobeIcon}
        emptyTitle={t("domains.empty")}
        emptyDescription={t("domains.emptyDescription")}
        skeletonRows={2}
      >
        <div className="flex flex-col gap-4">
          {items.map((d) => (
            <DomainCard key={d.id} domain={d} />
          ))}
        </div>
      </DataState>
    </>
  );
}

function DomainCard({ domain }: { domain: TenantDomain }) {
  const { t } = useTranslation("organizations");
  const verifyM = useVerifyDomain();
  const removeM = useRemoveDomain();
  const verified = !!domain.verified_at;
  const [confirmDialog, openConfirm] = useConfirmDialog();

  return (
    <>
      {confirmDialog}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <GlobeIcon className="size-4 text-muted-foreground" />
                <span className="font-mono">{domain.domain}</span>
                {verified ? (
                  <Badge variant="success">
                    <CheckCircle2Icon className="size-3" /> {t("domains.card.verified")}
                  </Badge>
                ) : (
                  <Badge variant="outline">{t("domains.card.pending")}</Badge>
                )}
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={removeM.isPending}
              onClick={() =>
                openConfirm({
                  title: t("domains.card.removeTitleWithDomain", {
                    domain: domain.domain,
                  }),
                  variant: "destructive",
                  confirmLabel: t("domains.card.removeConfirm"),
                  onConfirm: () => removeM.mutate(domain.id),
                })
              }
            >
              <Trash2Icon /> {t("domains.card.remove")}
            </Button>
          </div>
        </CardHeader>
        {!verified && (
          <CardContent className="flex flex-col gap-3">
            <CardDescription>{t("domains.card.dnsInstructions")}</CardDescription>
            <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
              <span className="text-sm text-muted-foreground">{t("domains.card.dnsName")}</span>
              <CopyableSecret value={domain.dns_record_name} size="sm" />
              <span className="text-sm text-muted-foreground">{t("domains.card.dnsType")}</span>
              <span className="font-mono text-sm">{domain.dns_record_type}</span>
              <span className="text-sm text-muted-foreground">{t("domains.card.dnsValue")}</span>
              <CopyableSecret value={domain.dns_record_value} size="sm" />
            </div>
            {verifyM.error && (
              <p className="text-destructive text-sm">{(verifyM.error as ApiError).message}</p>
            )}
            <div>
              <Button onClick={() => verifyM.mutate(domain.id)} disabled={verifyM.isPending}>
                {verifyM.isPending && <Loader2Icon className="animate-spin" />}
                {t("domains.card.verify")}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </>
  );
}

type Branding = {
  tenant_id: string;
  custom_domain?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  email_from_name?: string | null;
  email_from_address?: string | null;
  settings?: Record<string, unknown> | null;
};

function CustomLoginDomainPanel() {
  const { t } = useTranslation("settings");
  const tenantId = useTenantId();
  const qc = useQueryClient();
  const [domain, setDomain] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const brandQ = useQuery({
    queryKey: ["branding", tenantId],
    queryFn: () => api<Branding>(`/v1/tenants/${tenantId}/branding`),
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (brandQ.data) setDomain(brandQ.data.custom_domain ?? "");
  }, [brandQ.data]);

  const saveM = useMutation({
    mutationFn: () =>
      api<Branding>(`/v1/tenants/${tenantId}/branding`, {
        method: "PUT",
        body: { ...(brandQ.data ?? {}), custom_domain: domain || null },
      }),
    onSuccess: () => {
      setSavedAt(new Date());
      qc.invalidateQueries({ queryKey: ["branding", tenantId] });
    },
  });

  return (
    <>
      <p className="text-sm text-muted-foreground">{t("workspace.domains.description")}</p>

      <Card className="border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/20">
        <CardContent className="flex items-start gap-3 p-4">
          <ConstructionIcon className="size-5 text-amber-700 dark:text-amber-500" />
          <div className="text-sm">
            <p className="font-medium">{t("workspace.domains.pendingBanner.title")}</p>
            <p className="text-muted-foreground">
              {t("workspace.domains.pendingBanner.description")}
            </p>
          </div>
        </CardContent>
      </Card>

      <FeatureGate
        feature="custom_domain"
        title="Custom domains are a paid feature"
        description="Serve the hosted login from your own domain (auth.acme.com). Upgrade to Starter to add a custom domain."
      >
        {brandQ.isLoading ? (
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveM.mutate();
            }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("workspace.domains.custom.title")}</CardTitle>
                <CardDescription>{t("workspace.domains.custom.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="custom_domain">
                      {t("workspace.domains.custom.label")}
                    </FieldLabel>
                    <Input
                      id="custom_domain"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      placeholder="auth.acme.com"
                    />
                    <FieldDescription>
                      Status:{" "}
                      {brandQ.data?.custom_domain ? (
                        <Badge variant="warning" className="ml-1">
                          {t("workspace.domains.custom.statusConfigured")}
                        </Badge>
                      ) : (
                        <Badge variant="muted" className="ml-1">
                          {t("workspace.domains.custom.statusNone")}
                        </Badge>
                      )}
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel>{t("workspace.domains.custom.dnsRecords")}</FieldLabel>
                    <div className="rounded-md border bg-muted/50 p-3 text-xs font-mono space-y-1">
                      <div>
                        CNAME @ →{" "}
                        {tenantId
                          ? `${tenantId.slice(0, 8)}.tenants.id.qeet.in`
                          : "<tenant>.tenants.id.qeet.in"}
                      </div>
                      <div>
                        TXT _qeetid-verify →{" "}
                        {tenantId
                          ? `qeetid-verify=${tenantId.slice(0, 16)}`
                          : "qeetid-verify=<token>"}
                      </div>
                    </div>
                    <FieldDescription>{t("workspace.domains.custom.dnsHelp")}</FieldDescription>
                  </Field>
                  {saveM.error && (
                    <Field>
                      <FieldError>{(saveM.error as ApiError).message}</FieldError>
                    </Field>
                  )}
                </FieldGroup>
              </CardContent>
            </Card>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {savedAt
                  ? t("workspace.domains.footer.savedAt", {
                      time: savedAt.toLocaleTimeString(),
                    })
                  : t("workspace.domains.footer.unsaved")}{" "}
                · {t("workspace.domains.footer.brandingLink")}{" "}
                <Link to="/settings/branding" className="underline">
                  Branding
                </Link>
                .
              </p>
              <div className="flex items-center gap-2">
                <GlobeIcon className="size-4 text-muted-foreground" />
                <Button type="submit" disabled={saveM.isPending}>
                  {saveM.isPending && <Loader2Icon className="animate-spin" />}
                  {saveM.isSuccess && !saveM.isPending && <CheckIcon />}
                  {saveM.isPending
                    ? t("workspace.domains.footer.saving")
                    : t("workspace.domains.footer.save")}
                </Button>
              </div>
            </div>
          </form>
        )}
      </FeatureGate>
    </>
  );
}
