import { LinkIcon } from "@qeetrix/icons";
import { Button } from "@qeetrix/react";
import { Apple, Github, Google, Microsoft } from "@thesvg/react";
import { type ReactNode, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  isLastSignInMethod,
  usePlatformSocialProviders,
  useSignInMethods,
  useSocialIdentities,
  useStartSocialLink,
  useUnlinkIdentity,
} from "@/modules/authentication";
import { toastError } from "@/platform/errors/error-toast";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { relative } from "@/modules/account/relative-time";
import { Item, LoadFailed, Loading, Section } from "../account-parts";

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// A provider's own mark; one without an entry gets a link glyph. Monochrome marks drawn in white
// are inverted where they'd vanish (see .account-icon in account.css).
const PROVIDER_ICONS: Record<string, ReactNode> = {
  google: <Google />,
  microsoft: <Microsoft />,
  github: <Github data-invert="dark" />,
  apple: <Apple data-invert="light" />,
};

/**
 * The providers that can sign the person in: connect one, or disconnect it unless it's the last
 * way in. A row per offered provider, plus any connected one since withdrawn, so it can still be
 * disconnected.
 */
export function ConnectedSection() {
  const { t } = useTranslation("account");
  const runSensitive = useSensitiveAction();
  const identities = useSocialIdentities();
  const providers = usePlatformSocialProviders();
  const unlink = useUnlinkIdentity();
  const link = useStartSocialLink();
  const lastMethod = isLastSignInMethod(useSignInMethods().data);

  const linked = identities.data?.items ?? [];
  const byProvider = new Map(linked.map((identity) => [identity.provider.toLowerCase(), identity]));
  const names = [
    ...new Set([
      ...(providers.data?.providers ?? []).map((p) => p.toLowerCase()),
      ...linked.map((identity) => identity.provider.toLowerCase()),
    ]),
  ];

  // Back from connecting with ?linked=<provider> or ?link_error=already_linked: say so, refresh
  // the list and drop the query, so a reload won't say it again.
  const refetch = identities.refetch;
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const done = params.get("linked");
    const failed = params.get("link_error");
    if (!done && !failed) return;
    if (done) {
      toast.success(t("security.connected.linked", { provider: titleCase(done) }));
      void refetch();
    } else if (failed === "already_linked") {
      toast.error(t("security.connected.alreadyLinked"));
    }
    window.history.replaceState({}, "", window.location.pathname);
  }, [refetch, t]);

  // The offered providers are waited for on the first try only: a list that doesn't load still
  // leaves the connected ones to disconnect.
  const loading = identities.isPending || (providers.isPending && providers.failureCount === 0);
  if (!loading && !identities.isError && names.length === 0) return null;

  return (
    <Section
      title={t("security.connected.title")}
      description={t("security.connected.description")}
    >
      {loading ? (
        <Loading rows={2} />
      ) : identities.isError ? (
        <LoadFailed error={identities.error} onRetry={() => void identities.refetch()} />
      ) : (
        <ul className="account-rows">
          {names.map((provider) => {
            const identity = byProvider.get(provider);
            const label = titleCase(provider);
            return (
              <Item
                key={provider}
                icon={PROVIDER_ICONS[provider] ?? <LinkIcon />}
                name={label}
                line={
                  identity
                    ? t("security.connected.line", {
                        email: identity.email ?? label,
                        when: relative(identity.linked_at),
                      })
                    : t("security.connected.notConnected")
                }
                actions={
                  identity ? (
                    <Button
                      variant="ghost"
                      aria-label={t("security.connected.disconnectNamed", { provider: label })}
                      disabled={
                        lastMethod || (unlink.isPending && unlink.variables === identity.id)
                      }
                      title={lastMethod ? t("security.lastMethod") : undefined}
                      onClick={() =>
                        runSensitive({
                          confirm: {
                            title: t("security.connected.disconnectConfirm", { provider: label }),
                            description: t("security.connected.disconnectDescription"),
                            confirmLabel: t("security.connected.disconnect"),
                            tone: "destructive",
                          },
                          actionLabel: t("security.connected.disconnect"),
                          run: () => unlink.mutateAsync(identity.id),
                        }).catch(settleSensitiveAction)
                      }
                    >
                      {t("security.connected.disconnect")}
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      aria-label={t("security.connected.connectNamed", { provider: label })}
                      disabled={link.isPending}
                      onClick={() =>
                        runSensitive({
                          actionLabel: t("security.connected.connectNamed", { provider: label }),
                          // The hook is silent: success leaves the page, so a failure toasts here.
                          run: () =>
                            link.mutateAsync(provider, { onError: (err) => toastError(err) }),
                        }).catch(settleSensitiveAction)
                      }
                    >
                      {t("security.connected.connect")}
                    </Button>
                  )
                }
              />
            );
          })}
        </ul>
      )}
    </Section>
  );
}
