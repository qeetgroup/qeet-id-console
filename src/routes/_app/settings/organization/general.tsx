import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  TimeSince,
} from "@qeetrix/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "@/platform/errors/user-message";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircleIcon,
  Building2Icon,
  CalendarIcon,
  CheckIcon,
  CircleDotIcon,
  CopyIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  FingerprintIcon,
  GlobeIcon,
  InfoIcon,
  LightbulbIcon,
  Loader2Icon,
  LockIcon,
  UsersRoundIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { LogoField } from "@/shared/components/logo-field";
import { PageHeader } from "@/platform/components/page-header";
import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { REGIONS } from "@/shared/data/regions";

export const Route = createFileRoute("/_app/settings/organization/general")({
  component: WorkspaceGeneralPage,
});

type Tenant = {
  id: string;
  slug: string;
  name: string;
  status: "active" | "suspended" | "deleted";
  plan: string;
  region: string;
  logo_url: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

function WorkspaceGeneralPage() {
  const { t } = useTranslation("settings");
  const tenantId = useTenantId();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Partial<Tenant>>({});

  const tenantQ = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: () => api<Tenant>(`/v1/tenants/${tenantId}`),
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (tenantQ.data) setDraft(tenantQ.data);
  }, [tenantQ.data]);

  const saveM = useMutation({
    // plan is intentionally omitted — it's changed through billing, not here
    // (the backend no longer accepts plan on PATCH /v1/tenants).
    mutationFn: (body: { name?: string; region?: string; status?: string; logo_url?: string }) =>
      api<Tenant>(`/v1/tenants/${tenantId}`, { method: "PATCH", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant", tenantId] });
      qc.invalidateQueries({ queryKey: ["tenants"] });
    },
    meta: { successMessage: "Organization details saved" },
  });

  // Comparing against the server copy is what drives the unsaved-changes bar;
  // tracking a separate "dirty" flag would drift the moment a field is edited
  // back to its original value.
  const dirty =
    !!tenantQ.data &&
    (draft.name !== tenantQ.data.name ||
      draft.region !== tenantQ.data.region ||
      draft.status !== tenantQ.data.status ||
      (draft.logo_url ?? "") !== (tenantQ.data.logo_url ?? ""));

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-20">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <PageHeader description={t("workspace.general.description")} />
        <div className="flex shrink-0 items-center gap-3 rounded-xl border bg-primary/5 p-4 xl:w-80">
          <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-primary/10 text-primary">
            {draft.logo_url ? (
              <img src={draft.logo_url} alt="" className="size-full object-cover" />
            ) : (
              <Building2Icon className="size-5" />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate font-heading text-sm font-semibold">{draft.name ?? "—"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {t("workspace.general.tagline")}
            </p>
          </div>
        </div>
      </div>

      {tenantQ.isLoading ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveM.mutate({
              name: draft.name,
              region: draft.region,
              status: draft.status,
              logo_url: draft.logo_url ?? "",
            });
          }}
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Card>
                <CardHeader className="flex-row items-start gap-3 space-y-0">
                  <SectionIcon icon={<Building2Icon />} />
                  <div className="min-w-0">
                    <CardTitle className="text-base">
                      {t("workspace.general.profile.title")}
                    </CardTitle>
                    <CardDescription>{t("workspace.general.profile.description")}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="slug" className="gap-1.5">
                        {t("workspace.general.profile.slug")}
                        <InfoIcon
                          className="size-3.5 text-muted-foreground"
                          aria-label={t("workspace.general.profile.slugTooltip")}
                        />
                      </FieldLabel>
                      <Input id="slug" value={draft.slug ?? ""} disabled className="font-mono" />
                      <FieldDescription>{t("workspace.general.profile.slugHelp")}</FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="name">{t("workspace.general.profile.name")}</FieldLabel>
                      <Input
                        id="name"
                        value={draft.name ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                        required
                      />
                      <FieldDescription>{t("workspace.general.profile.nameHelp")}</FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel>{t("workspace.general.profile.logo")}</FieldLabel>
                      <LogoField
                        value={draft.logo_url ?? ""}
                        onChange={(v) => setDraft((d) => ({ ...d, logo_url: v }))}
                        subtitle={t("workspace.general.profile.logoHint")}
                        title={t("workspace.general.profile.logoTitle")}
                      />
                    </Field>
                    <Field className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel className="gap-1.5">
                          <CreditCardIcon className="size-3.5 text-muted-foreground" />
                          {t("workspace.general.profile.plan")}
                        </FieldLabel>
                        <Input
                          value={(draft.plan ?? "free").replace(/^./, (c) => c.toUpperCase())}
                          readOnly
                          disabled
                        />
                        <FieldDescription>
                          {t("workspace.general.profile.planHelp")}{" "}
                          <Link
                            to="/settings/billing"
                            className="inline-flex items-center gap-0.5 underline"
                          >
                            {t("workspace.general.profile.planHelpLink")}
                            <ExternalLinkIcon className="size-3" />
                          </Link>
                          .
                        </FieldDescription>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="region" className="gap-1.5">
                          <GlobeIcon className="size-3.5 text-muted-foreground" />
                          {t("workspace.general.profile.region")}
                        </FieldLabel>
                        <Select
                          value={draft.region ?? ""}
                          onValueChange={(v) => v && setDraft((d) => ({ ...d, region: v }))}
                        >
                          <SelectTrigger id="region">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {REGIONS.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldDescription>
                          {t("workspace.general.profile.regionHelp")}
                        </FieldDescription>
                      </Field>
                    </Field>
                    <Field>
                      <FieldLabel className="gap-1.5">
                        <CircleDotIcon className="size-3.5 text-muted-foreground" />
                        {t("workspace.general.profile.status")}
                      </FieldLabel>
                      <Select
                        value={draft.status ?? "active"}
                        onValueChange={(v) =>
                          setDraft((d) => ({
                            ...d,
                            status: v as Tenant["status"],
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">
                            {t("workspace.general.profile.statusActive")}
                          </SelectItem>
                          <SelectItem value="suspended">
                            {t("workspace.general.profile.statusSuspended")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldDescription>
                        {t("workspace.general.profile.statusHelp")}
                      </FieldDescription>
                    </Field>
                  </FieldGroup>
                </CardContent>
              </Card>

              {saveM.error && (
                <Card className="border-destructive">
                  <CardContent className="p-4">
                    <FieldError>{errorMessage(saveM.error)}</FieldError>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader className="flex-row items-start gap-3 space-y-0">
                  <SectionIcon icon={<FingerprintIcon />} />
                  <div className="min-w-0">
                    <CardTitle className="text-base">
                      {t("workspace.general.tenantId.title")}
                    </CardTitle>
                    <CardDescription>{t("workspace.general.tenantId.description")}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Field>
                    <FieldLabel htmlFor="org-id">
                      {t("workspace.general.tenantId.idLabel")}
                    </FieldLabel>
                    <div className="flex items-center gap-2">
                      <Input
                        id="org-id"
                        value={draft.id ?? ""}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={t("workspace.general.tenantId.copy")}
                        disabled={!draft.id}
                        onClick={() => {
                          if (!draft.id) return;
                          void navigator.clipboard.writeText(draft.id);
                          toast.success(t("workspace.general.tenantId.copied"));
                        }}
                      >
                        <CopyIcon className="size-4" />
                      </Button>
                    </div>
                  </Field>

                  <div className="flex items-start gap-3">
                    <CalendarIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {t("workspace.general.tenantId.created")}
                      </p>
                      {draft.created_at ? (
                        <>
                          <p className="text-sm text-muted-foreground">
                            {new Date(draft.created_at).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                          <TimeSince
                            value={draft.created_at}
                            className="text-xs text-muted-foreground"
                          />
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">—</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-start gap-3 space-y-0">
                  <SectionIcon icon={<LightbulbIcon />} />
                  <div className="min-w-0">
                    <CardTitle className="text-base">
                      {t("workspace.general.notes.title")}
                    </CardTitle>
                    <CardDescription>{t("workspace.general.notes.description")}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 border-t pt-4">
                  {(
                    [
                      { id: "slug", icon: <LockIcon /> },
                      { id: "region", icon: <GlobeIcon /> },
                      { id: "status", icon: <UsersRoundIcon /> },
                    ] as const
                  ).map((note) => (
                    <div key={note.id} className="flex items-start gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
                        {note.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {t(`workspace.general.notes.${note.id}.title`)}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {t(`workspace.general.notes.${note.id}.detail`)}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {dirty ? (
            <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <div className="mx-auto flex max-w-(--breakpoint-2xl) flex-wrap items-center justify-between gap-3 px-6 py-3">
                <div className="flex items-center gap-3">
                  <AlertCircleIcon className="size-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t("workspace.general.footer.unsaved")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("workspace.general.footer.unsavedDetail")}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => tenantQ.data && setDraft(tenantQ.data)}
                    disabled={saveM.isPending}
                  >
                    {t("workspace.general.footer.reset")}
                  </Button>
                  <Button type="submit" disabled={saveM.isPending}>
                    {saveM.isPending && <Loader2Icon className="animate-spin" />}
                    {saveM.isSuccess && !saveM.isPending && <CheckIcon />}
                    {saveM.isPending
                      ? t("workspace.general.footer.saving")
                      : t("workspace.general.footer.save")}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </form>
      )}
    </div>
  );
}

/** The tinted square that heads each card in this layout. */
function SectionIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5">
      {icon}
    </span>
  );
}
