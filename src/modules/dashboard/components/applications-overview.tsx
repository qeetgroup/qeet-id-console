import { buttonVariants, cn } from "@qeetrix/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRightIcon,
  ChevronRightIcon,
  KeyRoundIcon,
  LayersIcon,
  PlusIcon,
  ShieldCheckIcon,
  SquareStackIcon,
  TrendingUpIcon,
  ZapIcon,
} from "lucide-react";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { PageHeader } from "@/platform/components/page-header";
import { useCapabilities } from "@/platform/security/capability-provider";
import { useOAuthGrants, useOidcClients } from "@/modules/authentication";

/** Scopes every OIDC deployment ships with; anything else a tenant defines is custom. */
const STANDARD_SCOPES = new Set([
  "openid",
  "profile",
  "email",
  "address",
  "phone",
  "offline_access",
]);

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** How many of `dates` fall inside the last 30 days. */
function recentCount(dates: (string | undefined | null)[]): number {
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  return dates.filter((d) => {
    if (!d) return false;
    const t = new Date(d).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  }).length;
}

type Stat = {
  label: string;
  value: number;
  /** New in the last 30 days. Undefined when the source carries no timestamp. */
  added?: number;
  icon: React.ReactNode;
  tone: "primary" | "neutral" | "indigo";
  loading: boolean;
};

const TONES: Record<Stat["tone"], string> = {
  primary: "bg-primary/10 text-primary",
  neutral: "bg-muted text-muted-foreground",
  indigo: "bg-indigo-500/10 text-indigo-500 dark:text-indigo-400",
};

export function ApplicationsOverview({ description }: { description: string }) {
  const access = useCapabilities();
  const tenantId = useTenantId();

  const clientsQ = useOidcClients();
  const grantsQ = useOAuthGrants();
  const machineQ = useQuery({
    queryKey: ["service-principals", tenantId],
    enabled: !!tenantId && access.can("apikey.read"),
    queryFn: () => api<{ items: { id: string; created_at: string }[] }>("/v1/service-principals"),
  });
  const keysQ = useQuery({
    queryKey: ["api-keys", tenantId],
    enabled: !!tenantId && access.can("apikey.read"),
    queryFn: () =>
      api<{ items: { id: string; created_at: string; revoked_at?: string | null }[] }>(
        "/v1/api-keys",
      ),
  });

  const clients = clientsQ.data?.items ?? [];
  const grants = grantsQ.data?.items ?? [];
  const machines = machineQ.data?.items ?? [];
  const keys = (keysQ.data?.items ?? []).filter((k) => !k.revoked_at);

  // There is no scope registry endpoint; the honest count is the distinct
  // non-standard scopes actually requested by registered apps.
  const customScopes = new Set(
    clients.flatMap((c) => c.scopes ?? []).filter((s) => !STANDARD_SCOPES.has(s)),
  ).size;

  const stats: Stat[] = [
    {
      label: "Registered apps",
      value: clients.length,
      added: recentCount(clients.map((c) => c.created_at)),
      icon: <SquareStackIcon />,
      tone: "primary",
      loading: clientsQ.isPending,
    },
    {
      label: "Machine apps",
      value: machines.length,
      added: recentCount(machines.map((m) => m.created_at)),
      icon: <ZapIcon />,
      tone: "neutral",
      loading: machineQ.isPending,
    },
    {
      label: "Active grants",
      value: grants.length,
      added: recentCount(grants.map((g) => g.issued_at)),
      icon: <ShieldCheckIcon />,
      tone: "indigo",
      loading: grantsQ.isPending,
    },
    {
      label: "API keys",
      value: keys.length,
      added: recentCount(keys.map((k) => k.created_at)),
      icon: <KeyRoundIcon />,
      tone: "primary",
      loading: keysQ.isPending,
    },
    {
      label: "Custom scopes",
      value: customScopes,
      // Derived from the apps' scope lists, which carry no per-scope date.
      icon: <LayersIcon />,
      tone: "indigo",
      loading: clientsQ.isPending,
    },
  ];

  const areas = [
    {
      title: "Applications",
      url: "/auth/connections/oidc",
      description: "Your registered OIDC / OAuth relying-party apps.",
      detail: "View, configure, and manage client applications.",
      icon: <SquareStackIcon />,
      tone: "primary" as const,
      can: access.can("connection.read"),
    },
    {
      title: "Machine apps",
      url: "/auth/api/machine-identities",
      description: "Non-interactive service and machine identities.",
      detail: "Manage machine-to-machine applications and credentials.",
      icon: <ZapIcon />,
      tone: "neutral" as const,
      can: access.can("apikey.read"),
    },
    {
      title: "OAuth grants",
      url: "/auth/api/consent-grants",
      description: "Consents users have granted to your apps.",
      detail: "View and manage OAuth grants and consent records.",
      icon: <ShieldCheckIcon />,
      tone: "indigo" as const,
      can: access.can("connection.read"),
    },
    {
      title: "API keys",
      url: "/auth/api/keys",
      description: "Manage API keys for programmatic access.",
      detail: "Create, rotate, and revoke API keys.",
      icon: <KeyRoundIcon />,
      tone: "primary" as const,
      can: access.can("apikey.read"),
    },
    {
      title: "Scopes & permissions",
      url: "/authorization/permissions",
      description: "Define and manage custom scopes and permissions.",
      detail: "Control what your applications can access.",
      icon: <LayersIcon />,
      tone: "indigo" as const,
      can: access.can("role.read"),
    },
  ].filter((a) => a.can);

  const quickActions = [
    {
      title: "Register application",
      detail: "Create a new OIDC / OAuth app",
      url: "/auth/connections/oidc?action=create",
      icon: <SquareStackIcon />,
      can: access.can("connection.write"),
    },
    {
      title: "Create machine app",
      detail: "Set up a non-interactive app",
      url: "/auth/api/machine-identities?action=create",
      icon: <ZapIcon />,
      can: access.can("apikey.write"),
    },
    {
      title: "Generate API key",
      detail: "Create an API key for accessing APIs",
      url: "/auth/api/keys?action=create",
      icon: <KeyRoundIcon />,
      can: access.can("apikey.write"),
    },
    {
      title: "Review grants",
      detail: "View and manage OAuth grants",
      url: "/auth/api/consent-grants",
      icon: <ShieldCheckIcon />,
      can: access.can("connection.read"),
    },
  ].filter((a) => a.can);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader description={description} />
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {access.can("apikey.write") ? (
            <Link
              to="/auth/api/machine-identities"
              search={{ action: "create" } as never}
              className={buttonVariants({ variant: "outline" })}
            >
              <PlusIcon /> Create machine app
            </Link>
          ) : null}
          {access.can("connection.write") ? (
            <Link
              to="/auth/connections/oidc"
              search={{ action: "create" } as never}
              className={buttonVariants()}
            >
              <PlusIcon /> Register app
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((s) => (
          <StatCard key={s.label} stat={s} />
        ))}
      </div>

      {areas.length > 0 ? (
        <section className="enterprise-panel" aria-labelledby="applications-areas-title">
          <header className="enterprise-panel-header">
            <div>
              <h2 id="applications-areas-title" className="font-heading text-base font-semibold">
                Explore and manage
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Jump to any area in applications.
              </p>
            </div>
          </header>
          <nav aria-label="Application areas" className="grid md:grid-cols-2">
            {areas.map((a) => (
              <AreaCard key={a.url} {...a} />
            ))}
          </nav>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="enterprise-panel" aria-labelledby="getting-started-title">
          <header className="enterprise-panel-header items-center">
            <div>
              <h2 id="getting-started-title" className="font-heading text-base font-semibold">
                Getting started
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Set up your first application or explore the available capabilities.
              </p>
            </div>
            <a
              href="https://docs.qeet.in/qeet-id/applications"
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
            >
              View documentation <ArrowUpRightIcon />
            </a>
          </header>
          <ol className="grid gap-6 p-5 sm:grid-cols-3">
            {[
              {
                n: 1,
                title: "Register an application",
                detail: "Set up your first client application.",
              },
              { n: 2, title: "Configure permissions", detail: "Add requested scopes." },
              { n: 3, title: "Integrate and test", detail: "Use our SDKs or OAuth flows." },
            ].map((step) => (
              <li key={step.n} className="flex flex-col items-center text-center">
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-full text-sm font-semibold",
                    step.n === 1
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {step.n}
                </span>
                <span className="mt-3 text-sm font-medium">{step.title}</span>
                <span className="mt-1 text-xs leading-5 text-muted-foreground">{step.detail}</span>
              </li>
            ))}
          </ol>
        </section>

        {quickActions.length > 0 ? (
          <section className="enterprise-panel" aria-labelledby="quick-actions-title">
            <header className="enterprise-panel-header">
              <div>
                <h2 id="quick-actions-title" className="font-heading text-base font-semibold">
                  Quick actions
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Common tasks to manage your applications.
                </p>
              </div>
            </header>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {quickActions.map((a) => (
                <Link
                  key={a.title}
                  to={a.url.split("?")[0] as never}
                  search={(a.url.includes("action=create") ? { action: "create" } : {}) as never}
                  className="group flex items-center gap-3 rounded-lg border p-3 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
                    {a.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{a.title}</span>
                    <span className="block text-xs leading-5 text-muted-foreground">
                      {a.detail}
                    </span>
                  </span>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({ stat }: { stat: Stat }) {
  // Percentage against the count before this window, so "3 new on top of 21"
  // reads as +14% rather than +12.5% of the new total.
  const base = stat.added !== undefined ? stat.value - stat.added : 0;
  const pct = stat.added && base > 0 ? Math.round((stat.added / base) * 100) : 0;

  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-lg [&_svg]:size-4.5",
          TONES[stat.tone],
        )}
      >
        {stat.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">{stat.label}</p>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="font-heading text-2xl font-semibold tabular-nums">
            {stat.loading ? "—" : stat.value.toLocaleString()}
          </span>
          {!stat.loading && stat.added !== undefined && pct > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <TrendingUpIcon className="size-3" /> {pct}%
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {stat.loading
            ? "Loading…"
            : stat.added === undefined
              ? "Across registered apps"
              : stat.added > 0
                ? `+${stat.added} from last 30 days`
                : "No change"}
        </p>
      </div>
    </div>
  );
}

function AreaCard({
  title,
  url,
  description,
  detail,
  icon,
  tone,
}: {
  title: string;
  url: string;
  description: string;
  detail: string;
  icon: React.ReactNode;
  tone: Stat["tone"];
}) {
  return (
    <Link
      to={url as never}
      className="group flex items-start gap-4 border-t border-border/70 p-5 outline-none transition-colors hover:bg-muted/35 focus-visible:bg-muted/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:odd:border-e"
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-lg [&_svg]:size-4.5",
          TONES[tone],
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-sm font-semibold">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground/80">{detail}</span>
      </span>
      <ChevronRightIcon className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
