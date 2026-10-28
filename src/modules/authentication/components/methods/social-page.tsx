import { ChevronDownIcon, PlusIcon, Share2Icon } from "@qeetrix/icons";
import { Badge, Button } from "@qeetrix/react";
import { PageContent, PageHeader } from "@qeetrix/react/experimental";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { PageBreadcrumb } from "@/modules/dashboard";
import {
  type SocialProvider,
  useSocialProviders,
  useUpdateSocialProvider,
} from "@/modules/authentication/api/social";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { Failure, Item, LoadFailed, Loading, Section, when } from "./methods-parts";
import {
  findSocialProvider,
  NOT_OIDC,
  ProviderMark,
  SOCIAL_PROVIDERS,
  type SocialProviderMeta,
} from "./social-catalogue";
import { SocialProviderPanel } from "./social-provider-panel";
import { useSignInMix } from "./use-policy";
import "./methods.css";

// Long client IDs (Google's run to 70 characters) are cut in the row; the form shows them whole.
const shortId = (id: string) => (id.length > 28 ? `${id.slice(0, 24)}…` : id);
const labelOf = (provider: string) =>
  findSocialProvider(provider)?.label ?? provider.charAt(0).toLocaleUpperCase() + provider.slice(1);

type Open = { kind: "edit"; provider: string } | { kind: "add"; provider: string } | null;

/**
 * Authentication › Social: the providers people can sign in with. The ones set up first, each
 * with Edit and Turn off; then the ones that can be added. Adding or editing one opens its form
 * where its row was. Providers that can't be added at all are named in one line.
 */
export function SocialPage() {
  const { t } = useTranslation("authentication");
  const providers = useSocialProviders();
  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("social.title")}
        description={t("social.description")}
      />
      <PageContent width="narrow">
        {providers.isPending ? (
          <Loading rows={4} />
        ) : providers.isError ? (
          <LoadFailed error={providers.error} onRetry={() => void providers.refetch()} />
        ) : (
          <SocialSections configured={providers.data.items} />
        )}
      </PageContent>
    </>
  );
}

function SocialSections({ configured }: { configured: SocialProvider[] }) {
  const { t } = useTranslation("authentication");
  const canWrite = useCapabilities().can("connection.write");
  const runSensitive = useSensitiveAction();
  const update = useUpdateSocialProvider();
  const used = useSignInMix()?.social;
  const [open, setOpen] = useState<Open>(null);
  const [more, setMore] = useState(false);
  const close = () => setOpen(null);

  const on = configured.filter((p) => p.enabled).length;
  const setUp = new Set(configured.map((p) => p.provider));
  const addable = SOCIAL_PROVIDERS.filter((p) => !setUp.has(p.id));
  const ready = addable.filter((p) => p.discovery);
  const rest = addable.filter((p) => !p.discovery);
  const showRest = more || rest.some((p) => open?.kind === "add" && open.provider === p.id);

  // Turning one off is confirmed with what happens to people; turning it on needs the step-up.
  const toggle = (provider: SocialProvider) => {
    const label = labelOf(provider.provider);
    return runSensitive({
      confirm: provider.enabled
        ? {
            title: t("social.turnOffTitle", { label }),
            description: t("social.turnOffDescription", { label }),
            confirmLabel: t("methods.turnOff"),
            tone: "destructive",
          }
        : undefined,
      actionLabel: provider.enabled
        ? t("social.turnOffAction", { label })
        : t("social.turnOnAction", { label }),
      run: () => update.mutateAsync({ provider: provider.provider, enabled: !provider.enabled }),
    }).catch(settleSensitiveAction);
  };

  const addRow = (p: SocialProviderMeta) =>
    open?.kind === "add" && open.provider === p.id ? (
      <SocialProviderPanel
        key={p.id}
        id={p.id}
        label={p.label}
        discovery={p.discovery}
        onClose={close}
      />
    ) : (
      <Item
        key={p.id}
        icon={<ProviderMark id={p.id} />}
        name={p.label}
        line={p.discovery ? t("social.discoveryKnown") : t("social.discoveryNeeded")}
        actions={
          canWrite && (
            <Button
              variant="ghost"
              icon={PlusIcon}
              aria-label={t("social.addNamed", { label: p.label })}
              onClick={() => setOpen({ kind: "add", provider: p.id })}
            >
              {t("social.addRow")}
            </Button>
          )
        }
      />
    );

  return (
    <>
      <Section
        title={t("social.offeredTitle")}
        status={<Badge size="sm">{on}</Badge>}
        description={
          used === undefined ? t("social.offeredDescription") : t("social.offeredUsed", { n: used })
        }
      >
        <Failure error={update.error} />
        {configured.length === 0 ? (
          <p className="account-note">{t("social.none")}</p>
        ) : (
          <ul className="account-rows">
            {configured.map((p) => {
              const label = labelOf(p.provider);
              return open?.kind === "edit" && open.provider === p.provider ? (
                <SocialProviderPanel
                  key={p.provider}
                  id={p.provider}
                  label={label}
                  discovery={findSocialProvider(p.provider)?.discovery ?? ""}
                  existing={p}
                  onClose={close}
                />
              ) : (
                <Item
                  key={p.provider}
                  icon={
                    findSocialProvider(p.provider) ? (
                      <ProviderMark id={p.provider} />
                    ) : (
                      <Share2Icon />
                    )
                  }
                  name={label}
                  badge={
                    <Badge tone={p.enabled ? "success" : "neutral"} size="sm">
                      {p.enabled ? t("methods.on") : t("methods.off")}
                    </Badge>
                  }
                  line={
                    <>
                      {t("social.clientPrefix")}{" "}
                      <span className="account-mono">{shortId(p.client_id)}</span>
                      {" · "}
                      {t("social.added", { when: when(p.created_at) })}
                    </>
                  }
                  actions={
                    canWrite && (
                      <>
                        <Button
                          variant="ghost"
                          aria-label={t("social.editNamed", { label })}
                          onClick={() => setOpen({ kind: "edit", provider: p.provider })}
                        >
                          {t("methods.edit")}
                        </Button>
                        <Button
                          variant="ghost"
                          aria-label={t(
                            p.enabled ? "methods.turnOffNamed" : "methods.turnOnNamed",
                            {
                              name: label,
                            },
                          )}
                          loading={update.isPending && update.variables?.provider === p.provider}
                          onClick={() => void toggle(p)}
                        >
                          {p.enabled ? t("methods.turnOff") : t("methods.turnOn")}
                        </Button>
                      </>
                    )
                  }
                />
              );
            })}
          </ul>
        )}
      </Section>

      {addable.length > 0 && (
        <Section title={t("social.addTitle")} description={t("social.addDescription")}>
          <ul className="account-rows">
            {ready.map(addRow)}
            {showRest && rest.map(addRow)}
          </ul>
          {!showRest && rest.length > 0 && (
            <span className="account-adds am-tuck">
              <Button variant="ghost" icon={ChevronDownIcon} onClick={() => setMore(true)}>
                {t("social.more", { count: rest.length })}
              </Button>
            </span>
          )}
          <p className="account-note">
            {t("social.notOidc", {
              names: new Intl.ListFormat(formatLocale(), { type: "conjunction" }).format(NOT_OIDC),
            })}
          </p>
        </Section>
      )}
    </>
  );
}
