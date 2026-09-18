import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@qeetrix/ui";
import { QeetLogoOnLight, QeetLogoOnDark } from "@qeetrix/ui/brand";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  Building2Icon,
  CheckIcon,
  ChevronDownIcon,
  CrownIcon,
  GlobeIcon,
  LayoutGridIcon,
  ListIcon,
  Loader2Icon,
  LogOutIcon,
  PlusCircleIcon,
  RefreshCwIcon,
  SearchIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { EligibleOrganization } from "@/platform/auth/organization-selection";
import {
  type Me,
  useIdleLogout,
  useLogout,
  useMe,
  useTenantId,
  useUserId,
} from "@/platform/auth/session";
import { ThemeToggle } from "@/platform/components/theme-toggle";
import { errorMessage } from "@/platform/errors/user-message";
import { switchToTenant } from "../api/flows";
import { useEligibleOrganizations } from "../api/organization-selection";
import {
  filterOrganizations,
  mostRecentOrganization,
  organizationImage,
  organizationInitials,
  type OrganizationSort,
} from "../organization-selection-model";

const ACTION =
  "h-9 rounded-md px-3 text-xs focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11";
const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-rose-600",
  "bg-emerald-600",
  "bg-orange-600",
  "bg-violet-600",
  "bg-cyan-700",
];

export type OrganizationSelectorViewProps = {
  organizations: EligibleOrganization[];
  user?: Pick<Me, "id" | "email" | "display_name" | "avatar_url">;
  loading: boolean;
  error: boolean;
  fetching: boolean;
  signingOut?: boolean;
  entryError?: string | null;
  onRetry: () => unknown;
  onContinue: (organizationId: string) => Promise<unknown>;
  onCreate: () => void;
  onAccount: () => void;
  onSignOut: () => void;
};

export function OrganizationSelectionPage({ onCreate }: { onCreate: () => void }) {
  const userId = useUserId();
  const tenantId = useTenantId();
  const organizations = useEligibleOrganizations(userId);
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const [entryError, setEntryError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const automaticAttempt = useRef(-1);
  useIdleLogout(10 * 60 * 1000);

  useEffect(() => {
    if (
      !organizations.isSuccess ||
      organizations.data.length > 1 ||
      automaticAttempt.current === retry
    )
      return;
    automaticAttempt.current = retry;
    const only = organizations.data[0];
    const enter =
      only && only.id !== tenantId ? switchToTenant(only.id) : navigate({ to: "/", replace: true });
    void Promise.resolve(enter).catch((failure) => setEntryError(errorMessage(failure)));
  }, [organizations.data, organizations.isSuccess, tenantId, navigate, retry]);

  return (
    <OrganizationSelectorView
      organizations={organizations.isError ? [] : (organizations.data ?? [])}
      user={me.isError ? undefined : me.data}
      loading={
        organizations.isPending ||
        (organizations.isSuccess && organizations.data.length < 2 && !entryError)
      }
      error={organizations.isError}
      entryError={entryError}
      fetching={organizations.isFetching}
      signingOut={logout.isPending}
      onRetry={async () => {
        const result = await organizations.refetch();
        if (result.isSuccess) {
          setEntryError(null);
          setRetry((value) => value + 1);
        }
      }}
      onContinue={async (id) => {
        if (!organizations.data?.some((organization) => organization.id === id))
          throw new Error("Organization is no longer available");
        await switchToTenant(id);
      }}
      onCreate={onCreate}
      onAccount={() => void navigate({ to: "/account/profile" })}
      onSignOut={() => logout.mutate()}
    />
  );
}

export function OrganizationSelectorView(props: OrganizationSelectorViewProps) {
  const { t, i18n } = useTranslation("auth-flow");
  const id = useId();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [sort, setSort] = useState<OrganizationSort>("recent");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<string | null>(null);
  const [selectionTouched, setSelectionTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const organizations = props.error ? [] : props.organizations;
  const recent = mostRecentOrganization(organizations);
  const candidate = selectionTouched ? selected : recent;
  const visible = filterOrganizations(organizations, search, role, sort, i18n.language);
  const selectedOrganization = visible.find((organization) => organization.id === candidate);
  const roles = [...new Set(organizations.flatMap((organization) => organization.roles))].sort(
    (first, second) => first.localeCompare(second),
  );
  const accountName =
    props.user?.display_name?.trim() || props.user?.email || t("organizationSelection.yourAccount");
  const controlsDisabled = pending || !!props.signingOut;
  const roleLabel = (name: string) =>
    ["owner", "admin", "member"].includes(name.toLowerCase())
      ? t(`organizationSelection.roles.${name.toLowerCase()}`)
      : name;
  const planLabel = (plan: string) =>
    ["free", "starter", "pro", "enterprise"].includes(plan.replace(/_year$/, ""))
      ? t(`organizationSelection.plans.${plan.replace(/_year$/, "")}`)
      : plan || t("organizationSelection.notReported");

  async function submit() {
    if (busy.current || !selectedOrganization || props.error || props.loading || props.signingOut)
      return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await props.onContinue(selectedOrganization.id);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <div className="console-shell flex min-h-dvh min-w-0 flex-col text-foreground">
      <a
        href="#organization-selection"
        className="sr-only focus:not-sr-only focus:fixed focus:inset-s-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:p-3 focus:text-sm focus:outline-2 focus:outline-ring"
      >
        {t("organizationSelection.skip")}
      </a>
      <header className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-card/55 px-4 py-1 backdrop-blur-sm sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="relative grid size-9 shrink-0 place-items-center rounded-lg border border-border/40 bg-muted/30"
            aria-hidden="true"
          >
            <span className="absolute opacity-100 dark:opacity-0">
              <QeetLogoOnLight size={24} title={null} />
            </span>
            <span className="absolute opacity-0 dark:opacity-100">
              <QeetLogoOnDark size={24} title={null} />
            </span>
          </span>
          <span className="font-heading text-sm font-semibold">Qeet ID</span>
          <span className="hidden border-s border-border/70 ps-3 text-[10px] uppercase text-muted-foreground sm:block">
            {t("organizationSelection.controlPlane")}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  className="h-auto min-h-10 max-w-52 gap-2 rounded-md px-2"
                  aria-label={t("organizationSelection.accountMenu")}
                  disabled={controlsDisabled}
                />
              }
            >
              <Avatar className="size-8 shrink-0">
                <AvatarImage src={organizationImage(props.user?.avatar_url)} alt="" />
                <AvatarFallback className="bg-muted text-[10px]">
                  {organizationInitials(accountName)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden min-w-0 text-start sm:block">
                <span className="block truncate text-xs font-medium">{accountName}</span>
                {props.user?.email && (
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {props.user.email}
                  </span>
                )}
              </span>
              <ChevronDownIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={props.onAccount}>
                <SettingsIcon />
                {t("organizationSelection.accountSettings")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={props.onSignOut}>
                <LogOutIcon />
                {t("organizationSelection.signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main
        id="organization-selection"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-5 pt-8 focus:outline-none sm:px-10"
      >
        <div className="mx-auto mb-7 flex max-w-2xl flex-col items-center text-center sm:mb-2">
          <span className="mb-5 grid size-13 place-items-center rounded-lg border border-border/60 bg-muted/25 shadow-xs">
            <Building2Icon
              className="size-6 text-foreground/80"
              strokeWidth={1.6}
              aria-hidden="true"
            />
          </span>
          <p className="flex items-center gap-2 text-[10px] font-medium uppercase text-muted-foreground">
            <span className="h-px w-5 bg-primary" aria-hidden="true" />
            {t("organizationSelection.eyebrow")}
          </p>
          <h1 className="mt-3 font-heading text-[28px] font-semibold leading-9 sm:text-[30px]">
            {t("organizationSelection.title")}
          </h1>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">
            {props.loading
              ? t("organizationSelection.loading")
              : props.error
                ? t("organizationSelection.loadError")
                : t("organizationSelection.description", { count: organizations.length })}
          </p>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 basis-full sm:flex-1 sm:basis-auto">
            <SearchIcon
              className="pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              aria-label={t("organizationSelection.search")}
              placeholder={t("organizationSelection.searchPlaceholder")}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setError(null);
              }}
              disabled={controlsDisabled || props.loading || props.error}
              className="h-10 rounded-md bg-card/75 ps-10 pe-9 text-xs pointer-coarse:min-h-11 pointer-coarse:text-base [&::-webkit-search-cancel-button]:appearance-none"
            />
            {search && (
              <button
                type="button"
                aria-label={t("organizationSelection.clearSearch")}
                title={t("organizationSelection.clearSearch")}
                onClick={() => setSearch("")}
                disabled={controlsDisabled}
                className="absolute inset-e-1 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                <XIcon className="size-3.5" />
              </button>
            )}
          </div>
          <Select
            value={role ? `role:${role}` : "all"}
            onValueChange={(value) => {
              setRole(value?.startsWith("role:") ? value.slice(5) : "");
              setError(null);
            }}
            disabled={controlsDisabled || props.loading || props.error}
          >
            <SelectTrigger
              aria-label={t("organizationSelection.roleFilter")}
              className="h-10 w-32 rounded-md bg-card/75 text-xs pointer-coarse:min-h-11"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("organizationSelection.allRoles")}</SelectItem>
              {roles.map((name) => (
                <SelectItem key={name} value={`role:${name}`}>
                  {roleLabel(name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sort}
            onValueChange={(value) => {
              if (value === "recent" || value === "name" || value === "name-desc") setSort(value);
            }}
            disabled={controlsDisabled || props.loading || props.error}
          >
            <SelectTrigger
              aria-label={t("organizationSelection.sort")}
              className="h-10 w-39 rounded-md bg-card/75 text-xs pointer-coarse:min-h-11"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["recent", "name", "name-desc"] as const).map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`organizationSelection.sorts.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <fieldset
            aria-label={t("organizationSelection.layout")}
            className="inline-flex h-10 items-center gap-0.5 rounded-md border border-border/70 bg-card/65 p-0.5 pointer-coarse:h-12"
          >
            {(["grid", "list"] as const).map((value) => {
              const Icon = value === "grid" ? LayoutGridIcon : ListIcon;
              return (
                <Tooltip key={value}>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label={t(`organizationSelection.${value}View`)}
                        aria-pressed={layout === value}
                        disabled={controlsDisabled}
                        onClick={() => setLayout(value)}
                        className={cn(
                          "grid size-8 cursor-pointer place-items-center rounded transition-colors focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:size-10",
                          layout === value
                            ? "bg-muted text-foreground shadow-xs ring-1 ring-border"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      />
                    }
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent>{t(`organizationSelection.${value}View`)}</TooltipContent>
                </Tooltip>
              );
            })}
          </fieldset>
        </div>

        {props.loading ? (
          <div
            role="status"
            aria-label={t("organizationSelection.loading")}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {["first", "second", "third", "fourth", "fifth"].map((item) => (
              <Skeleton key={item} className="h-34 rounded-lg" />
            ))}
          </div>
        ) : props.error ? (
          <section
            role="alert"
            className="grid min-h-60 place-content-center justify-items-center gap-3 px-5 text-center"
          >
            <Building2Icon className="size-8 text-muted-foreground/70" aria-hidden="true" />
            <h2 className="font-heading text-base font-semibold">
              {t("organizationSelection.loadError")}
            </h2>
            <Button
              variant="outline"
              className={ACTION}
              disabled={props.fetching}
              onClick={() => void props.onRetry()}
            >
              <RefreshCwIcon aria-hidden="true" />
              {t("organizationSelection.retry")}
            </Button>
          </section>
        ) : visible.length === 0 ? (
          <section className="grid min-h-60 place-content-center justify-items-center gap-3 text-center">
            <SearchIcon className="size-7 text-muted-foreground/60" aria-hidden="true" />
            <h2 className="font-heading text-base font-semibold">
              {t(
                organizations.length === 0
                  ? "organizationSelection.empty"
                  : "organizationSelection.noMatches",
              )}
            </h2>
            {organizations.length > 0 && (
              <Button
                variant="outline"
                className={ACTION}
                onClick={() => {
                  setSearch("");
                  setRole("");
                }}
              >
                <RefreshCwIcon aria-hidden="true" />
                {t("organizationSelection.resetFilters")}
              </Button>
            )}
          </section>
        ) : (
          <fieldset
            disabled={controlsDisabled}
            className="min-w-0"
            aria-label={t("organizationSelection.available")}
          >
            <div
              data-organization-layout={layout}
              className={cn(
                "grid min-w-0 grid-cols-1 gap-3",
                layout === "grid" && "sm:grid-cols-2 lg:grid-cols-3",
              )}
            >
              {visible.map((organization) => {
                const chosen = selectedOrganization?.id === organization.id;
                const lastUsed = recent === organization.id;
                const color =
                  AVATAR_COLORS[
                    organization.id
                      .split("")
                      .reduce((sum, character) => sum + character.charCodeAt(0), 0) %
                      AVATAR_COLORS.length
                  ];
                return (
                  <div key={organization.id} className="relative min-w-0">
                    <input
                      type="radio"
                      id={`${id}-${organization.id}`}
                      name={`${id}-organization`}
                      aria-label={organization.name}
                      value={organization.id}
                      checked={chosen}
                      onChange={() => {
                        setSelected(organization.id);
                        setSelectionTouched(true);
                        setError(null);
                      }}
                      className="peer sr-only"
                    />
                    <label
                      htmlFor={`${id}-${organization.id}`}
                      data-organization-id={organization.id}
                      className={cn(
                        "relative flex h-full min-w-0 cursor-pointer gap-3.5 rounded-lg border px-4 py-4 shadow-xs transition-colors motion-reduce:transition-none peer-focus-visible:outline-2 peer-focus-visible:outline-solid peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring peer-disabled:cursor-wait peer-disabled:opacity-65",
                        layout === "grid" ? "min-h-29" : "min-h-24 items-center",
                        chosen
                          ? "border-primary/80 bg-primary/4 dark:bg-primary/7"
                          : "border-border/70 bg-card/80 hover:border-primary/40 hover:bg-card dark:bg-card/60 dark:hover:bg-card/90",
                      )}
                    >
                      <Avatar className="mt-0.5 size-11 shrink-0 rounded-lg">
                        <AvatarImage
                          src={organizationImage(organization.logo_url)}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="object-contain"
                        />
                        <AvatarFallback
                          className={cn(
                            "rounded-lg font-heading text-base font-semibold text-white",
                            color,
                          )}
                        >
                          {organizationInitials(organization.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={cn(
                          "min-w-0 flex-1 pe-6",
                          layout === "list" &&
                            "sm:flex sm:items-center sm:justify-between sm:gap-4",
                        )}
                      >
                        <div className={cn("min-w-0", layout === "list" && "sm:flex-1")}>
                          <p
                            className={cn(
                              "font-heading text-sm font-semibold leading-5 wrap-break-word",
                              lastUsed && layout === "grid" && "pe-12",
                            )}
                          >
                            {organization.name}
                          </p>
                          <p
                            className="mt-0.5 truncate text-xs text-muted-foreground"
                            title={organization.domain || organization.slug}
                          >
                            {organization.domain || organization.slug}
                          </p>
                        </div>
                        <div
                          className={cn(
                            "mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground",
                            layout === "list" && "sm:mt-0 sm:flex-1",
                          )}
                        >
                          <span
                            className="inline-flex min-w-0 items-center gap-1"
                            title={t("organizationSelection.region")}
                          >
                            <GlobeIcon className="size-3 shrink-0" aria-hidden="true" />
                            <span className="truncate">
                              {organization.region || t("organizationSelection.notReported")}
                            </span>
                          </span>
                          <span aria-hidden="true">&middot;</span>
                          <span
                            className="inline-flex items-center gap-1"
                            title={t("organizationSelection.plan")}
                          >
                            <CrownIcon className="size-3 shrink-0" aria-hidden="true" />
                            {planLabel(organization.plan)}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "mt-2 flex min-w-0 flex-wrap gap-1",
                            layout === "list" && "sm:mt-0 sm:max-w-40 sm:justify-end",
                          )}
                        >
                          {organization.roles.map((name) => (
                            <span
                              key={name}
                              title={roleLabel(name)}
                              className={cn(
                                "max-w-full truncate rounded px-2 py-0.5 text-[10px] font-medium",
                                name.toLowerCase() === "owner"
                                  ? "bg-success/10 text-success"
                                  : name.toLowerCase() === "admin"
                                    ? "bg-info/10 text-info"
                                    : "bg-muted text-muted-foreground",
                              )}
                            >
                              {roleLabel(name)}
                            </span>
                          ))}
                        </div>
                      </div>
                      {lastUsed && (
                        <span
                          className={cn(
                            "absolute inset-e-3 top-2 rounded-full bg-primary/12 px-2 py-0.5 text-[9px] font-medium text-primary",
                            layout === "list" && "inset-e-10",
                          )}
                          title={
                            organization.last_used_at
                              ? new Date(organization.last_used_at).toLocaleString(i18n.language)
                              : undefined
                          }
                        >
                          {t("organizationSelection.lastUsed")}
                        </span>
                      )}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute inset-e-4 top-1/2 grid size-4.5 -translate-y-1/2 place-items-center rounded-full border",
                          chosen
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/45 bg-background/30",
                        )}
                      >
                        {chosen && <CheckIcon className="size-3" strokeWidth={3} />}
                      </span>
                    </label>
                  </div>
                );
              })}
            </div>
          </fieldset>
        )}

        {(error || props.entryError) && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            <p>{error || props.entryError}</p>
            {props.entryError && (
              <Button
                variant="outline"
                className={cn(ACTION, "mt-3 text-foreground")}
                onClick={() => void props.onRetry()}
                disabled={props.fetching || controlsDisabled}
              >
                <RefreshCwIcon aria-hidden="true" />
                {t("organizationSelection.retry")}
              </Button>
            )}
          </div>
        )}
        {!props.loading && !props.error && (search || role) && (
          <p role="status" className="mt-3 text-xs text-muted-foreground">
            {t("organizationSelection.results", {
              count: visible.length,
              total: organizations.length,
            })}
          </p>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-6">
          <Button
            type="button"
            variant="outline"
            className={cn(ACTION, "bg-card/70")}
            onClick={props.onCreate}
            disabled={controlsDisabled}
          >
            <PlusCircleIcon aria-hidden="true" />
            {t("organizationSelection.create")}
          </Button>
          <Button
            type="button"
            className={cn(ACTION, "ms-auto h-10 px-5")}
            disabled={!selectedOrganization || controlsDisabled || props.loading || props.error}
            onClick={() => void submit()}
          >
            {pending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
            {t(pending ? "organizationSelection.entering" : "organizationSelection.continue")}
            <ArrowRightIcon aria-hidden="true" />
          </Button>
        </div>
      </main>

      <footer className="mx-auto grid w-full max-w-6xl grid-cols-2 items-center gap-4 px-5 pb-6 pt-4 sm:grid-cols-[1fr_auto_1fr] sm:px-10">
        <Button
          variant="ghost"
          className={cn(ACTION, "justify-self-start px-1 text-muted-foreground")}
          onClick={props.onSignOut}
          disabled={controlsDisabled}
        >
          <LogOutIcon aria-hidden="true" />
          {t("organizationSelection.signOut")}
        </Button>
        <div className="col-span-2 row-start-2 text-center sm:col-span-1 sm:row-start-auto">
          <p className="font-heading text-xs font-medium">Qeet ID</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {t("organizationSelection.tagline")}
          </p>
        </div>
        <Button
          variant="ghost"
          className={cn(
            ACTION,
            "col-start-2 row-start-1 justify-self-end px-1 text-muted-foreground sm:col-start-auto sm:row-start-auto",
          )}
          onClick={props.onAccount}
          disabled={controlsDisabled}
        >
          <SettingsIcon aria-hidden="true" />
          {t("organizationSelection.accountSettings")}
        </Button>
      </footer>
    </div>
  );
}
