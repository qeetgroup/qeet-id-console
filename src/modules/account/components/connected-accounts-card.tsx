import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@qeetrix/ui";
import { LinkIcon, TrashIcon } from "@qeetrix/icons";
import { Apple, Github, Google, Microsoft } from "@thesvg/react";
import { type ReactNode, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  isLastSignInMethod,
  useSignInMethods,
  usePlatformSocialProviders,
  useSocialIdentities,
  useStartSocialLink,
  useUnlinkIdentity,
} from "@/modules/authentication";
import { toastError } from "@/platform/errors/error-toast";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { formatDate } from "@/shared/utils/format";

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// A provider without an entry gets a generic link glyph.
const PROVIDER_ICONS: Record<string, ReactNode> = {
  google: <Google />,
  microsoft: <Microsoft />,
  github: <Github className="dark:invert" />,
  apple: <Apple className="invert dark:invert-0" />,
};

/**
 * Renders the social accounts that can sign the person in: link one, or unlink it unless it is
 * the last way in. A row per configured provider, plus any linked one since unconfigured, so a
 * linked provider can always be unlinked.
 */
export function ConnectedAccountsCard({ className }: { className?: string }) {
  const { t } = useTranslation("account");
  const runSensitive = useSensitiveAction();
  const identitiesQ = useSocialIdentities();
  const providersQ = usePlatformSocialProviders();
  const unlink = useUnlinkIdentity();
  const link = useStartSocialLink();
  // The server refuses removing the last way to sign in; say so before the button is pressed.
  const lastMethod = isLastSignInMethod(useSignInMethods().data);

  const identities = identitiesQ.data?.items ?? [];
  const linkedByProvider = new Map(identities.map((i) => [i.provider.toLowerCase(), i]));
  const providers = [
    ...new Set([
      ...(providersQ.data?.providers ?? []).map((p) => p.toLowerCase()),
      ...identities.map((i) => i.provider.toLowerCase()),
    ]),
  ];

  // Back from a link ceremony with ?linked=<provider> or ?link_error=already_linked: report it,
  // refresh the list and strip the query, so a reload won't report it again.
  const refetchIdentities = identitiesQ.refetch;
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linked = params.get("linked");
    const linkError = params.get("link_error");
    if (!linked && !linkError) return;
    if (linked) {
      toast.success(t("security.connected.linked", { provider: titleCase(linked) }));
      void refetchIdentities();
    } else if (linkError === "already_linked") {
      toast.error(t("security.connected.alreadyLinked"));
    }
    window.history.replaceState({}, "", window.location.pathname);
  }, [refetchIdentities, t]);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <LinkIcon className="size-5 text-muted-foreground" />
          <CardTitle className="text-base">{t("security.connected.title")}</CardTitle>
        </div>
        <CardDescription>{t("security.connected.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {providers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("security.connected.empty")}</p>
        ) : (
          <ul className="divide-y">
            {providers.map((provider) => {
              const linked = linkedByProvider.get(provider);
              const label = titleCase(provider);
              return (
                <li
                  key={provider}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-md border bg-background [&_svg]:size-4">
                      {PROVIDER_ICONS[provider] ?? <LinkIcon />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {linked
                          ? `${linked.email ?? "—"} ${t("security.connected.linkedAt", {
                              date: formatDate(linked.linked_at),
                            })}`
                          : t("security.connected.notConnected")}
                      </p>
                    </div>
                  </div>
                  {linked ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={unlink.isPending || lastMethod}
                      title={lastMethod ? t("security.lastMethod") : undefined}
                      onClick={() =>
                        runSensitive({
                          confirm: {
                            title: t("security.connected.unlinkConfirm", { provider: label }),
                            description: t("security.connected.unlinkDescription"),
                            confirmLabel: t("security.connected.unlink"),
                            tone: "destructive",
                          },
                          actionLabel: t("security.connected.unlinkAction").toLowerCase(),
                          run: () => unlink.mutateAsync(linked.id),
                        }).catch(settleSensitiveAction)
                      }
                    >
                      <TrashIcon /> {t("security.connected.unlink")}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={link.isPending}
                      onClick={() =>
                        runSensitive({
                          actionLabel: t("security.connected.linkAction", { provider: label }),
                          // The hook is silent: success leaves the page, so a failure toasts here.
                          run: () =>
                            link.mutateAsync(provider, { onError: (err) => toastError(err) }),
                        }).catch(settleSensitiveAction)
                      }
                    >
                      {t("security.connected.link")}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
