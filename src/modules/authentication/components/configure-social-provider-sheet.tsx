import {
  Badge,
  Button,
  Callout,
  Card,
  CardContent,
  Field,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@qeetrix/ui";
import { GlobeIcon, KeyRoundIcon, LinkIcon, SaveIcon, TrashIcon } from "@qeetrix/icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

import {
  type SocialProvider,
  socialRedirectUri,
  useDeleteSocialProvider,
  useUpdateSocialProvider,
  useUpsertSocialProvider,
} from "../api/social";
import {
  SOCIAL_PROVIDERS,
  type SocialProviderMeta,
  SocialProviderMark,
} from "./social-provider-catalogue";
import { SocialProviderAdvancedTab } from "./configure-social-provider-sheet-advanced";
import { CopyableUrlPanel, SectionHeading } from "./configure-social-provider-sheet-parts";

type ConfigureSocialProviderSheetProps = {
  provider: SocialProviderMeta;
  /** The tenant's saved credentials, when this provider is already configured. */
  existing?: SocialProvider;
  onClose: () => void;
};

/**
 * Renders the "Configure <provider>" slide-over. The fields sit on the configuration tab, which a
 * failed validation brings back into view. Saving keeps whether the provider is switched on and,
 * if the secret is blank, the stored one.
 */
export function ConfigureSocialProviderSheet({
  provider,
  existing,
  onClose,
}: ConfigureSocialProviderSheetProps) {
  const { t } = useTranslation("authentication");
  const upsertM = useUpsertSocialProvider();
  const updateM = useUpdateSocialProvider();
  const deleteM = useDeleteSocialProvider();
  const runSensitive = useSensitiveAction();

  const [tab, setTab] = useState<"configuration" | "advanced">("configuration");
  const schema = useMemo(
    () =>
      z.object({
        client_id: z.string().trim().min(1, t("social.configure.validation.clientId")),
        // A configured provider keeps its stored secret when the field is blank.
        client_secret: existing
          ? z.string()
          : z.string().trim().min(1, t("social.configure.validation.clientSecret")),
        discovery_url: z.url({
          protocol: /^https$/,
          error: t("social.configure.validation.discoveryUrl"),
        }),
      }),
    [existing, t],
  );
  const form = useAppForm({
    defaultValues: {
      client_id: existing?.client_id ?? "",
      client_secret: "",
      discovery_url: existing?.discovery_url ?? provider.discovery ?? "",
    },
    validators: { onSubmit: schema },
    onSubmitInvalid: () => setTab("configuration"),
    onSubmit: async ({ value, formApi }) => {
      await runSensitive({
        actionLabel: t("social.configure.stepUp.save"),
        run: () =>
          upsertM.mutateAsync({
            provider: provider.id,
            client_id: value.client_id.trim(),
            client_secret: value.client_secret.trim(),
            discovery_url: value.discovery_url.trim(),
          }),
      })
        .then((saved) => saved && onClose())
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
        });
    },
  });

  const redirectUri = socialRedirectUri(provider.id);
  const isEnabled = !!existing?.enabled;
  const actionError = upsertM.error ?? updateM.error ?? deleteM.error;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      {/* The kit caps a right sheet at 24rem with an attribute selector that outweighs a plain
          utility, hence the important modifier. */}
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[40rem]!">
        <form
          className="flex h-full min-h-0 flex-col"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <SheetHeader className="gap-0 border-b p-5">
            <div className="flex items-start gap-4 pe-9">
              <SocialProviderMark provider={provider} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle className="text-lg">
                    {t("social.configure.title", { label: provider.label })}
                  </SheetTitle>
                  <Badge variant={existing ? "success" : "muted"}>
                    {existing ? t("social.badges.configured") : t("social.badges.notConfigured")}
                  </Badge>
                </div>
                <SheetDescription className="mt-1.5">
                  {t("social.configure.description", { label: provider.label })}
                </SheetDescription>
                {existing && (
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <Switch
                      id="social-provider-enabled"
                      checked={isEnabled}
                      disabled={updateM.isPending}
                      onCheckedChange={(on) =>
                        runSensitive({
                          actionLabel:
                            on === true
                              ? t("social.configure.stepUp.enable")
                              : t("social.configure.stepUp.disable"),
                          run: () =>
                            updateM.mutateAsync({ provider: provider.id, enabled: on === true }),
                        }).catch(settleSensitiveAction)
                      }
                    />
                    <FieldLabel htmlFor="social-provider-enabled">
                      {t("social.configure.enabledLabel")}
                    </FieldLabel>
                  </div>
                )}
              </div>
            </div>
          </SheetHeader>

          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as typeof tab)}
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            <TabsList className="mx-5 mt-4 w-fit shrink-0">
              <TabsTrigger value="configuration">
                {t("social.configure.tabs.configuration")}
              </TabsTrigger>
              <TabsTrigger value="advanced">{t("social.configure.tabs.advanced")}</TabsTrigger>
            </TabsList>

            <TabsContent
              value="configuration"
              keepMounted
              className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5"
            >
              <Card>
                <CardContent className="space-y-4 p-4">
                  <SectionHeading
                    icon={<LinkIcon className="size-4" />}
                    title={t("social.configure.details.title")}
                    subtitle={t("social.configure.details.subtitle")}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="social-provider">
                        {t("social.configure.providerLabel")}
                      </FieldLabel>
                      {/* The provider is chosen on the card behind this sheet;
                          shown here so the form reads completely. */}
                      <Select value={provider.id} disabled>
                        <SelectTrigger id="social-provider">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SOCIAL_PROVIDERS.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Callout variant="info" className="text-xs">
                      {t("social.configure.protocolHint", { label: provider.label })}
                    </Callout>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-4 p-4">
                  <SectionHeading
                    icon={<KeyRoundIcon className="size-4" />}
                    title={t("social.configure.credentials.title")}
                    subtitle={t("social.configure.credentials.subtitle", { label: provider.label })}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <form.AppField name="client_id">
                      {(field) => (
                        <field.TextField
                          label={t("social.configure.clientIdLabel")}
                          description={t("social.configure.clientIdHelp", {
                            label: provider.label,
                          })}
                          placeholder={t("social.configure.clientIdPlaceholder")}
                          autoComplete="off"
                          spellCheck={false}
                          required
                        />
                      )}
                    </form.AppField>
                    <form.AppField name="client_secret">
                      {(field) => (
                        <field.PasswordField
                          label={t("social.configure.clientSecretLabel")}
                          description={
                            existing
                              ? t("social.configure.clientSecretHelpKeep")
                              : t("social.configure.clientSecretHelp")
                          }
                          placeholder="••••••••••••••••"
                          autoComplete="new-password"
                          required={!existing}
                        />
                      )}
                    </form.AppField>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-4 p-4">
                  <SectionHeading
                    icon={<GlobeIcon className="size-4" />}
                    title={t("social.configure.endpoints.title")}
                    subtitle={t("social.configure.endpoints.subtitle")}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <form.AppField name="discovery_url">
                      {(field) => (
                        <field.TextField
                          label={t("social.configure.discoveryLabel")}
                          description={t("social.configure.discoveryHelp", {
                            label: provider.label,
                          })}
                          placeholder="https://provider.example/.well-known/openid-configuration"
                          type="url"
                          autoComplete="off"
                          spellCheck={false}
                          required
                        />
                      )}
                    </form.AppField>
                    <CopyableUrlPanel
                      icon={<LinkIcon className="size-3.5" />}
                      title={t("social.configure.redirectTitle")}
                      value={redirectUri}
                      help={t("social.configure.redirectHelp", { label: provider.label })}
                      copyLabel={t("social.configure.copyLabel")}
                      copiedLabel={t("social.configure.copiedLabel")}
                    />
                  </div>
                </CardContent>
              </Card>

              <FormError error={actionError} />
            </TabsContent>

            <TabsContent value="advanced" className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <SocialProviderAdvancedTab provider={provider} existing={existing} />
            </TabsContent>
          </Tabs>

          <SheetFooter className="mt-0 shrink-0 flex-row items-center justify-between gap-2 border-t p-4">
            <div className="flex items-center gap-2">
              <SheetClose render={<Button type="button" variant="outline" />}>
                {t("social.configure.cancelBtn")}
              </SheetClose>
              {existing && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive"
                  disabled={deleteM.isPending}
                  onClick={() =>
                    runSensitive({
                      confirm: {
                        title: t("social.configure.remove.title", { label: provider.label }),
                        description: t("social.configure.remove.description"),
                        confirmLabel: t("social.configure.remove.confirm"),
                        tone: "destructive",
                      },
                      actionLabel: t("social.configure.stepUp.remove"),
                      run: () => deleteM.mutateAsync(provider.id),
                    })
                      .then(() => onClose())
                      .catch(settleSensitiveAction)
                  }
                >
                  <TrashIcon />
                  {t("social.configure.remove.button")}
                </Button>
              )}
            </div>
            <form.AppForm>
              <form.SubmitButton icon={<SaveIcon />} pendingLabel={t("social.configure.savingBtn")}>
                {t("social.configure.saveBtn")}
              </form.SubmitButton>
            </form.AppForm>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
