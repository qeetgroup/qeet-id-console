import {
  Badge,
  Button,
  Callout,
  Card,
  CardContent,
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  PasswordInput,
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
  StatusPill,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useCopyToClipboard,
} from "@qeetrix/ui";
import {
  CheckIcon,
  CopyIcon,
  GlobeIcon,
  KeyRoundIcon,
  LinkIcon,
  Loader2Icon,
  NetworkIcon,
  PlayIcon,
  SaveIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { errorMessage } from "@/platform/errors/user-message";
import { formatDateTime } from "@/shared/utils/format";

import { socialStartUrl } from "../api/flows";
import { type SocialProvider, socialRedirectUri, useUpsertSocialProvider } from "../api/social";
import {
  SOCIAL_PROVIDERS,
  type SocialProviderMeta,
  SocialProviderMark,
} from "./social-provider-catalogue";

type ConfigureSocialProviderSheetProps = {
  provider: SocialProviderMeta;
  /** The tenant's saved credentials, when this provider is already configured. */
  existing?: SocialProvider;
  onClose: () => void;
};

/**
 * The "Configure <provider>" slide-over: client credentials, endpoints and the
 * read-only diagnostics under Advanced.
 *
 * Inputs are controlled rather than read from FormData on submit (the house
 * form convention) because the panels are tabbed: a hidden panel unmounts, and
 * native `required` validation cannot focus a control inside one. Validation
 * therefore happens here — `canSave` gates the submit button.
 *
 * `POST /v1/social/providers` accepts client_id, client_secret and
 * discovery_url and nothing else. The comps' enable/disable switch, Scopes
 * field and "Test configuration" button are left out until the server has
 * endpoints for them, rather than shipping controls that do nothing.
 */
export function ConfigureSocialProviderSheet({
  provider,
  existing,
  onClose,
}: ConfigureSocialProviderSheetProps) {
  const { t } = useTranslation("auth");
  const upsertM = useUpsertSocialProvider();

  const [clientId, setClientId] = useState(existing?.client_id ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [discoveryUrl, setDiscoveryUrl] = useState(
    existing?.discovery_url ?? provider.discovery ?? "",
  );

  const redirectUri = socialRedirectUri(provider.id);
  const isEnabled = !!existing?.enabled;
  const canSave =
    !!clientId.trim() && !!clientSecret.trim() && !!discoveryUrl.trim() && !upsertM.isPending;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      {/* The kit caps a right-side sheet at 24rem through
          `data-[side=right]:sm:max-w-sm`, whose attribute selector outweighs a
          plain utility — hence the important modifier to reach the comps' 40rem. */}
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[40rem]!">
        <form
          className="flex h-full min-h-0 flex-col"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSave) return;
            upsertM.mutate(
              {
                provider: provider.id,
                client_id: clientId.trim(),
                client_secret: clientSecret.trim(),
                discovery_url: discoveryUrl.trim(),
              },
              { onSuccess: () => onClose() },
            );
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
              </div>
            </div>
          </SheetHeader>

          <Tabs defaultValue="configuration" className="flex min-h-0 flex-1 flex-col gap-0">
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
                    <Field>
                      <FieldLabel htmlFor="social-client-id">
                        {t("social.configure.clientIdLabel")} <RequiredMark />
                      </FieldLabel>
                      <Input
                        id="social-client-id"
                        name="client_id"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder={t("social.configure.clientIdPlaceholder")}
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                      />
                      <FieldDescription>
                        {t("social.configure.clientIdHelp", { label: provider.label })}
                      </FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="social-client-secret">
                        {t("social.configure.clientSecretLabel")} <RequiredMark />
                      </FieldLabel>
                      <PasswordInput
                        id="social-client-secret"
                        name="client_secret"
                        autoComplete="new-password"
                        placeholder="••••••••••••••••"
                        value={clientSecret}
                        onChange={(e) => setClientSecret(e.target.value)}
                      />
                      <FieldDescription>
                        {t("social.configure.clientSecretHelp")}
                        {existing ? ` ${t("social.configure.clientSecretReplaceHelp")}` : ""}
                      </FieldDescription>
                    </Field>
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
                    <Field>
                      <FieldLabel htmlFor="social-discovery-url">
                        {t("social.configure.discoveryLabel")} <RequiredMark />
                      </FieldLabel>
                      <Input
                        id="social-discovery-url"
                        name="discovery_url"
                        type="url"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="https://provider.example/.well-known/openid-configuration"
                        value={discoveryUrl}
                        onChange={(e) => setDiscoveryUrl(e.target.value)}
                      />
                      <FieldDescription>
                        {t("social.configure.discoveryHelp", { label: provider.label })}
                      </FieldDescription>
                    </Field>
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

              {upsertM.error && (
                <FieldGroup>
                  <Field>
                    <FieldError>{errorMessage(upsertM.error)}</FieldError>
                  </Field>
                </FieldGroup>
              )}
            </TabsContent>

            <TabsContent value="advanced" className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <Card>
                <CardContent className="space-y-4 p-4">
                  <SectionHeading
                    icon={<NetworkIcon className="size-4" />}
                    title={t("social.configure.advanced.endpointsTitle")}
                    subtitle={t("social.configure.advanced.endpointsSubtitle")}
                  />
                  <div className="grid gap-4">
                    <CopyableUrlPanel
                      icon={<LinkIcon className="size-3.5" />}
                      title={t("social.configure.redirectTitle")}
                      value={redirectUri}
                      help={t("social.configure.advanced.redirectHelp")}
                      copyLabel={t("social.configure.copyLabel")}
                      copiedLabel={t("social.configure.copiedLabel")}
                    />
                    <CopyableUrlPanel
                      icon={<PlayIcon className="size-3.5" />}
                      title={t("social.configure.advanced.startTitle")}
                      value={socialStartUrl(provider.id)}
                      help={t("social.configure.advanced.startHelp")}
                      copyLabel={t("social.configure.copyLabel")}
                      copiedLabel={t("social.configure.copiedLabel")}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-4 p-4">
                  <SectionHeading
                    icon={<ShieldCheckIcon className="size-4" />}
                    title={t("social.configure.advanced.statusTitle")}
                    subtitle={t("social.configure.advanced.statusSubtitle")}
                  />
                  <DescriptionList>
                    <DescriptionTerm>{t("social.configure.advanced.state")}</DescriptionTerm>
                    <DescriptionDetails>
                      {existing ? (
                        <StatusPill kind={isEnabled ? "success" : "muted"}>
                          {isEnabled
                            ? t("social.configure.stateOn")
                            : t("social.configure.stateOff")}
                        </StatusPill>
                      ) : (
                        <StatusPill kind="muted">{t("social.badges.notConfigured")}</StatusPill>
                      )}
                    </DescriptionDetails>
                    <DescriptionTerm>
                      {t("social.configure.advanced.requestedScopes")}
                    </DescriptionTerm>
                    <DescriptionDetails className="font-mono text-xs">
                      openid email profile
                    </DescriptionDetails>
                    {existing && (
                      <>
                        <DescriptionTerm>{t("social.configure.clientIdLabel")}</DescriptionTerm>
                        <DescriptionDetails className="break-all font-mono text-xs">
                          {existing.client_id}
                        </DescriptionDetails>
                        <DescriptionTerm>{t("social.configure.discoveryLabel")}</DescriptionTerm>
                        <DescriptionDetails className="break-all font-mono text-xs">
                          {existing.discovery_url || "—"}
                        </DescriptionDetails>
                        <DescriptionTerm>{t("social.configure.advanced.updated")}</DescriptionTerm>
                        <DescriptionDetails>
                          {formatDateTime(existing.updated_at)}
                        </DescriptionDetails>
                      </>
                    )}
                  </DescriptionList>
                  <Callout variant="warning" className="text-xs">
                    {t("social.configure.advanced.lifecycleNote")}
                  </Callout>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <SheetFooter className="mt-0 shrink-0 flex-row items-center justify-between gap-2 border-t p-4">
            <SheetClose render={<Button type="button" variant="outline" />}>
              {t("social.configure.cancelBtn")}
            </SheetClose>
            <Button type="submit" disabled={!canSave}>
              {upsertM.isPending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
              {upsertM.isPending ? t("social.configure.savingBtn") : t("social.configure.saveBtn")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/** Section title block: tiled icon, title, subtitle, and an optional status chip. */
function SectionHeading({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-none">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

/** Read-only URL the admin has to paste into the provider's own console. */
function CopyableUrlPanel({
  icon,
  title,
  value,
  help,
  copyLabel,
  copiedLabel,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  help: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-medium">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={copied ? copiedLabel : copyLabel}
          onClick={() => copy(value)}
        >
          {copied ? (
            <CheckIcon className="size-3.5 text-success" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
        </Button>
      </div>
      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{help}</p>
    </div>
  );
}

/** Small red asterisk marking a required field, matching the comps. */
function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  );
}
