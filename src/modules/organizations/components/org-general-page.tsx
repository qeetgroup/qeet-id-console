import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Input,
  Skeleton,
  TimeSince,
} from "@qeetrix/ui";
import { useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  BuildingComplexIcon,
  CalendarIcon,
  CheckIcon,
  CircleAlertIcon,
  CircleDotIcon,
  CopyIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  FingerprintPatternIcon,
  GlobeIcon,
  InfoIcon,
  LightbulbIcon,
  LoaderCircleIcon,
  LockIcon,
  UsersRoundIcon,
} from "@qeetrix/icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { formatLocale } from "@/i18n";
import { useTenantId } from "@/platform/auth/session";
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
import { LogoField } from "@/shared/components/logo-field";
import { REGIONS } from "@/shared/data/regions";

import { type Org, orgQueries, useUpdateOrg } from "../api/orgs";

const SKELETON_IDS = ["a", "b", "c", "d"] as const;

/** Renders the active organization's general settings: name, logo, region and status. */
export function OrgGeneralPage() {
  const tenantId = useTenantId();
  const orgQ = useQuery(orgQueries.record(tenantId));
  return (
    <DataState
      isLoading={orgQ.isLoading}
      isError={orgQ.isError}
      error={orgQ.error}
      loading={
        <Card>
          <CardContent className="space-y-3 p-6">
            {SKELETON_IDS.map((id) => (
              <Skeleton key={id} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      }
    >
      {/* Keyed by the saved record, so the form starts again from what the server holds. */}
      {orgQ.data ? (
        <GeneralSettingsForm key={orgQ.data.updated_at ?? orgQ.data.id} org={orgQ.data} />
      ) : null}
    </DataState>
  );
}

function GeneralSettingsForm({ org }: { org: Org }) {
  const { t, i18n } = useTranslation("organizations");
  const runSensitive = useSensitiveAction();
  const saveM = useUpdateOrg({ silentError: true });
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("workspace.general.validation.name")),
        logo_url: z.string(),
        region: z.string(),
        status: z.enum(["active", "suspended"]),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: {
      name: org.name,
      logo_url: org.logo_url ?? "",
      region: org.region ?? "",
      status: (org.status === "suspended" ? "suspended" : "active") as "active" | "suspended",
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      const suspending = value.status === "suspended" && org.status !== "suspended";
      // No plan: it changes through billing, and PATCH /v1/tenants doesn't accept it.
      await runSensitive({
        // Suspending blocks every member's sign-in, so it is confirmed like the Suspend action.
        confirm: suspending
          ? {
              title: t("workspace.general.suspend.title"),
              description: t("workspace.general.suspend.description", { name: org.name }),
              confirmLabel: t("workspace.general.suspend.confirm"),
              tone: "destructive",
            }
          : undefined,
        actionLabel: t("workspace.general.actionLabel"),
        run: () => saveM.mutateAsync({ id: org.id, body: { ...value, name: value.name.trim() } }),
      }).catch((err: unknown) => {
        applyServerErrors(formApi, err);
        settleSensitiveAction(err);
      });
    },
  });
  const values = useStore(form.store, (state) => state.values);
  // Compared with the saved values, so editing a field back to them hides the unsaved bar.
  const pristine = useStore(form.store, (state) => state.isDefaultValue);

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-20">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <PageHeader description={t("workspace.general.description")} />
        <div className="flex shrink-0 items-center gap-3 rounded-xl border bg-primary/5 p-4 xl:w-80">
          <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-primary/10 text-primary">
            {values.logo_url ? (
              <img src={values.logo_url} alt="" className="size-full object-cover" />
            ) : (
              <BuildingComplexIcon className="size-5" />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate font-heading text-sm font-semibold">{values.name || "—"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {t("workspace.general.tagline")}
            </p>
          </div>
        </div>
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader className="flex-row items-start gap-3 space-y-0">
                <SectionIcon icon={<BuildingComplexIcon />} />
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
                    <Input id="slug" value={org.slug} disabled className="font-mono" />
                    <FieldDescription>{t("workspace.general.profile.slugHelp")}</FieldDescription>
                  </Field>
                  <form.AppField name="name">
                    {(field) => (
                      <field.TextField
                        label={t("workspace.general.profile.name")}
                        description={t("workspace.general.profile.nameHelp")}
                        required
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="logo_url">
                    {(field) => (
                      <FieldFrame label={t("workspace.general.profile.logo")}>
                        <OrgLogoInput
                          value={field.state.value}
                          title={t("workspace.general.profile.logoTitle")}
                          subtitle={t("workspace.general.profile.logoHint")}
                        />
                      </FieldFrame>
                    )}
                  </form.AppField>
                  <Field className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel className="gap-1.5">
                        <CreditCardIcon className="size-3.5 text-muted-foreground" />
                        {t("workspace.general.profile.plan")}
                      </FieldLabel>
                      <Input
                        value={(org.plan ?? "free").replace(/^./, (c) => c.toUpperCase())}
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
                    <form.AppField name="region">
                      {(field) => (
                        <field.SelectField
                          label={
                            <>
                              <GlobeIcon className="size-3.5 text-muted-foreground" />
                              {t("workspace.general.profile.region")}
                            </>
                          }
                          description={t("workspace.general.profile.regionHelp")}
                          options={REGIONS.map((r) => ({ value: r.value, label: i18n.t(r.label) }))}
                        />
                      )}
                    </form.AppField>
                  </Field>
                  <form.AppField name="status">
                    {(field) => (
                      <field.SelectField
                        label={
                          <>
                            <CircleDotIcon className="size-3.5 text-muted-foreground" />
                            {t("workspace.general.profile.status")}
                          </>
                        }
                        description={t("workspace.general.profile.statusHelp")}
                        options={[
                          { value: "active", label: t("workspace.general.profile.statusActive") },
                          {
                            value: "suspended",
                            label: t("workspace.general.profile.statusSuspended"),
                          },
                        ]}
                      />
                    )}
                  </form.AppField>
                </FieldGroup>
              </CardContent>
            </Card>

            <FormError error={saveM.error} />
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-start gap-3 space-y-0">
                <SectionIcon icon={<FingerprintPatternIcon />} />
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
                      value={org.id ?? ""}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={t("workspace.general.tenantId.copy")}
                      disabled={!org.id}
                      onClick={() => {
                        if (!org.id) return;
                        void navigator.clipboard.writeText(org.id);
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
                    <p className="text-sm font-medium">{t("workspace.general.tenantId.created")}</p>
                    {org.created_at ? (
                      <>
                        <p className="text-sm text-muted-foreground">
                          {new Date(org.created_at).toLocaleString(formatLocale(), {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                        <TimeSince
                          value={org.created_at}
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
                  <CardTitle className="text-base">{t("workspace.general.notes.title")}</CardTitle>
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

        {!pristine ? (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="mx-auto flex max-w-(--breakpoint-2xl) flex-wrap items-center justify-between gap-3 px-6 py-3">
              <div className="flex items-center gap-3">
                <CircleAlertIcon className="size-5 shrink-0 text-primary" />
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
                  onClick={() => form.reset()}
                  disabled={saveM.isPending}
                >
                  {t("workspace.general.footer.reset")}
                </Button>
                <Button type="submit" disabled={saveM.isPending}>
                  {saveM.isPending && <LoaderCircleIcon className="animate-spin" />}
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
    </div>
  );
}

// The shared logo picker, bound to the enclosing form field.
function OrgLogoInput({
  value,
  title,
  subtitle,
}: {
  value: string;
  title: string;
  subtitle: string;
}) {
  const change = useFieldChange<string>();
  return <LogoField value={value} onChange={change} title={title} subtitle={subtitle} />;
}

/** The tinted square that heads each card in this layout. */
function SectionIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5">
      {icon}
    </span>
  );
}
