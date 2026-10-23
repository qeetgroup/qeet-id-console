import { Button, cn, Skeleton } from "@qeetrix/ui";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  BuildingComplexIcon,
  CirclePlusIcon,
  LoaderCircleIcon,
  LogOutIcon,
  RefreshCwIcon,
  SearchIcon,
  SettingsIcon,
} from "@qeetrix/icons";
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
import { errorMessage } from "@/platform/errors/user-message";
import { switchToTenant } from "../api/flows";
import { useEligibleOrganizations } from "../api/organization-selection";
import {
  filterOrganizations,
  mostRecentOrganization,
  type OrganizationSort,
} from "../organization-selection-model";
import { OrganizationSelectorCard } from "./organization-selector-card";
import { OrganizationSelectorHeader } from "./organization-selector-header";
import {
  type OrganizationLayout,
  OrganizationSelectorToolbar,
} from "./organization-selector-toolbar";

const ACTION =
  "h-9 rounded-md px-3 text-xs focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11";

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
  const [layout, setLayout] = useState<OrganizationLayout>("grid");
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
      <OrganizationSelectorHeader
        user={props.user}
        accountName={accountName}
        disabled={controlsDisabled}
        onAccount={props.onAccount}
        onSignOut={props.onSignOut}
      />

      <main
        id="organization-selection"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-5 pt-8 focus:outline-none sm:px-10"
      >
        <div className="mx-auto mb-7 flex max-w-2xl flex-col items-center text-center sm:mb-2">
          <span className="mb-5 grid size-13 place-items-center rounded-lg border border-border/60 bg-muted/25 shadow-xs">
            <BuildingComplexIcon
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

        <OrganizationSelectorToolbar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setError(null);
          }}
          onSearchClear={() => setSearch("")}
          role={role}
          roles={roles}
          roleLabel={roleLabel}
          onRoleChange={(value) => {
            setRole(value);
            setError(null);
          }}
          sort={sort}
          onSortChange={setSort}
          layout={layout}
          onLayoutChange={setLayout}
          disabled={controlsDisabled}
          filtersDisabled={controlsDisabled || props.loading || props.error}
        />

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
            <BuildingComplexIcon className="size-8 text-muted-foreground/70" aria-hidden="true" />
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
              {visible.map((organization) => (
                <OrganizationSelectorCard
                  key={organization.id}
                  organization={organization}
                  group={id}
                  chosen={selectedOrganization?.id === organization.id}
                  lastUsed={recent === organization.id}
                  layout={layout}
                  roleLabel={roleLabel}
                  planLabel={planLabel}
                  onSelect={() => {
                    setSelected(organization.id);
                    setSelectionTouched(true);
                    setError(null);
                  }}
                />
              ))}
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
            <CirclePlusIcon aria-hidden="true" />
            {t("organizationSelection.create")}
          </Button>
          <Button
            type="button"
            className={cn(ACTION, "ms-auto h-10 px-5")}
            disabled={!selectedOrganization || controlsDisabled || props.loading || props.error}
            onClick={() => void submit()}
          >
            {pending ? <LoaderCircleIcon className="animate-spin" aria-hidden="true" /> : null}
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
