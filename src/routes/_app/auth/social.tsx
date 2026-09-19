import {
  Badge,
  Button,
  Card,
  CardContent,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  useCopyToClipboard,
} from "@qeetrix/ui";
import { createFileRoute } from "@tanstack/react-router";
import {
  BanIcon,
  CheckCircle2Icon,
  ClockIcon,
  CopyIcon,
  ExternalLinkIcon,
  InfoIcon,
  LayoutGridIcon,
  ListFilterIcon,
  MoreVerticalIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  Share2Icon,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  type SocialProvider,
  socialRedirectUri,
  useSocialProviders,
} from "@/modules/authentication/api/social";
import { ConfigureSocialProviderSheet } from "@/modules/authentication/components/configure-social-provider-sheet";
import {
  SOCIAL_PROVIDERS,
  type SocialProviderMeta,
  SocialProviderMark,
} from "@/modules/authentication/components/social-provider-catalogue";
import { PageHeader } from "@/platform/components/page-header";
import { DOCS_URL } from "@/platform/config/site-urls";

export const Route = createFileRoute("/_app/auth/social")({
  component: SocialPage,
});

const SOCIAL_DOCS_URL = `${DOCS_URL}/docs/authentication/social-logins`;

type ProviderFilter = "all" | "configured" | "notConfigured" | "unsupported";

const FILTERS: ProviderFilter[] = ["all", "configured", "notConfigured", "unsupported"];

function SocialPage() {
  const { t } = useTranslation("auth");
  const listQ = useSocialProviders();
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProviderFilter>("all");

  const configured = new Map((listQ.data?.items ?? []).map((p) => [p.provider, p]));

  // Every provider lands in exactly one bucket, so the four tiles add up to the
  // catalogue. "Needs setup" is a supported provider whose discovery URL we
  // can't pre-fill — the admin has to find it in their own IdP first.
  const summary = SOCIAL_PROVIDERS.reduce(
    (acc, p) => {
      if (p.support === "unsupported") acc.unsupported += 1;
      else if (configured.has(p.id)) acc.configured += 1;
      else if (p.discovery) acc.available += 1;
      else acc.needsSetup += 1;
      return acc;
    },
    { configured: 0, available: 0, needsSetup: 0, unsupported: 0 },
  );

  const needle = query.trim().toLowerCase();
  const visible = SOCIAL_PROVIDERS.filter((p) => {
    if (needle && !p.label.toLowerCase().includes(needle) && !p.id.includes(needle)) return false;
    if (filter === "configured") return configured.has(p.id);
    if (filter === "notConfigured") return p.support !== "unsupported" && !configured.has(p.id);
    if (filter === "unsupported") return p.support === "unsupported";
    return true;
  });

  const editingMeta = SOCIAL_PROVIDERS.find((p) => p.id === editingProvider);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        icon={Share2Icon}
        description={t("social.description")}
        actions={
          <Button
            variant="outline"
            size="sm"
            render={<a href={SOCIAL_DOCS_URL} target="_blank" rel="noopener noreferrer" />}
          >
            <ExternalLinkIcon /> {t("social.viewDocsBtn")}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile
          icon={CheckCircle2Icon}
          tone="success"
          value={summary.configured}
          label={t("social.summary.configured")}
          hint={t("social.summary.configuredHint")}
        />
        <SummaryTile
          icon={LayoutGridIcon}
          tone="neutral"
          value={summary.available}
          label={t("social.summary.available")}
          hint={t("social.summary.availableHint")}
        />
        <SummaryTile
          icon={ClockIcon}
          tone="warning"
          value={summary.needsSetup}
          label={t("social.summary.needsSetup")}
          hint={t("social.summary.needsSetupHint")}
        />
        <SummaryTile
          icon={BanIcon}
          tone="neutral"
          value={summary.unsupported}
          label={t("social.summary.unsupported")}
          hint={t("social.summary.unsupportedHint")}
        />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold">
            {t("social.listTitle", { n: SOCIAL_PROVIDERS.length })}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
              <SearchIcon
                className="pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                aria-label={t("social.searchLabel")}
                placeholder={t("social.searchPlaceholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="ps-9 [&::-webkit-search-cancel-button]:appearance-none"
              />
            </div>
            <Select value={filter} onValueChange={(v) => v && setFilter(v as ProviderFilter)}>
              <SelectTrigger className="w-44" aria-label={t("social.filter.label")}>
                <span className="flex min-w-0 items-center gap-2">
                  <ListFilterIcon className="size-4 shrink-0 text-muted-foreground" />
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent>
                {FILTERS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {t(`social.filter.${f}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {visible.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {visible.map((p) => (
              <ProviderCard
                key={p.id}
                provider={p}
                existing={configured.get(p.id)}
                loading={listQ.isLoading}
                onConfigure={() => setEditingProvider(p.id)}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent>
              <EmptyState
                icon={SearchIcon}
                title={t("social.noResultsTitle")}
                description={t("social.noResultsDesc")}
              />
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground">
          {t("social.showingCount", { n: visible.length })}
        </p>
      </div>

      {editingMeta && (
        <ConfigureSocialProviderSheet
          provider={editingMeta}
          existing={configured.get(editingMeta.id)}
          onClose={() => setEditingProvider(null)}
        />
      )}
    </div>
  );
}

const TILE_TONES = {
  success: { tile: "border-success/30 bg-success/8", chip: "bg-success/15 text-success" },
  warning: { tile: "border-warning/30 bg-warning/8", chip: "bg-warning/15 text-warning" },
  neutral: { tile: "bg-card", chip: "bg-muted text-foreground/75" },
} as const;

function SummaryTile({
  icon: Icon,
  tone,
  value,
  label,
  hint,
}: {
  icon: typeof CheckCircle2Icon;
  tone: keyof typeof TILE_TONES;
  value: number;
  label: string;
  hint: string;
}) {
  const tone_ = TILE_TONES[tone];
  return (
    <div className={cn("flex items-center gap-4 rounded-xl border p-4", tone_.tile)}>
      <span
        className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", tone_.chip)}
      >
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="flex items-baseline gap-2">
          <span className="font-heading text-[1.75rem] font-semibold leading-none">{value}</span>
          <span className="truncate text-sm font-medium">{label}</span>
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
  existing,
  loading,
  onConfigure,
}: {
  provider: SocialProviderMeta;
  existing?: SocialProvider;
  loading: boolean;
  onConfigure: () => void;
}) {
  const { t } = useTranslation("auth");
  const { copy } = useCopyToClipboard();
  const isUnsupported = provider.support === "unsupported";

  const kindLabel = isUnsupported
    ? null
    : provider.support === "first-party"
      ? t("social.kind.firstParty")
      : t("social.kind.supported");

  return (
    <Card className="h-full gap-0">
      <CardContent className="flex h-full flex-col gap-3">
        <div className="flex items-start gap-3">
          <SocialProviderMark provider={provider} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate font-heading text-sm font-medium">{provider.label}</p>
              {loading && !isUnsupported ? (
                <Skeleton className="h-4 w-20" />
              ) : (
                <Badge variant={existing ? "success" : "muted"} className="font-normal">
                  {isUnsupported
                    ? t("social.badges.unsupported")
                    : existing
                      ? t("social.badges.configured")
                      : t("social.badges.notConfigured")}
                </Badge>
              )}
            </div>
            {kindLabel && <p className="mt-0.5 text-xs text-muted-foreground">{kindLabel}</p>}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="-me-1 size-7 text-muted-foreground"
                  aria-label={t("social.menu.label", { label: provider.label })}
                >
                  <MoreVerticalIcon className="size-4" aria-hidden="true" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" sideOffset={4} className="min-w-52">
              {!isUnsupported && (
                <DropdownMenuItem onClick={onConfigure}>
                  {existing ? (
                    <SettingsIcon className="size-3.5" />
                  ) : (
                    <PlusIcon className="size-3.5" />
                  )}
                  {existing ? t("social.menu.manage") : t("social.menu.configure")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => {
                  copy(socialRedirectUri(provider.id));
                  toast.success(t("social.menu.copiedRedirect"));
                }}
              >
                <CopyIcon className="size-3.5" aria-hidden="true" />
                {t("social.menu.copyRedirect")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                render={<a href={SOCIAL_DOCS_URL} target="_blank" rel="noopener noreferrer" />}
              >
                <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
                {t("social.menu.docs")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="text-xs leading-5 text-muted-foreground">
          {isUnsupported ? t("social.unsupportedDesc") : t(`social.providers.${provider.id}`)}
        </p>

        <Button
          variant="outline"
          size="sm"
          className="mt-auto w-full"
          disabled={isUnsupported}
          onClick={onConfigure}
        >
          {isUnsupported ? (
            <>
              <InfoIcon /> {t("social.notSupportedBtn")}
            </>
          ) : existing ? (
            <>
              <SettingsIcon /> {t("social.manageBtn")}
            </>
          ) : (
            <>
              <PlusIcon /> {t("social.configureBtn")}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
