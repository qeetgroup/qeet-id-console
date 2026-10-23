import {
  Button,
  buttonVariants,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
} from "@qeetrix/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  CircleCheckIcon,
  CircleIcon,
  type IconProps,
  KeyRoundIcon,
  PaletteIcon,
  PartyPopperIcon,
  ShieldCheckIcon,
  UsersIcon,
  WebhookIcon,
  XIcon,
} from "@qeetrix/icons";
import { type ComponentType, useState } from "react";

import { useCapabilities } from "@/platform/security/capability-provider";
import { CHECKLIST_INTRO, CHECKLIST_ORDER } from "@/modules/onboarding";
import { useTenantId } from "@/platform/auth/session";
import { scopedStorage, useStorageScope } from "@/platform/auth/scoped-storage";
import { oidcClientQueries } from "@/modules/authentication";
import { brandingQueries } from "@/modules/branding";
import { apiKeyQueries, webhookQueries } from "@/modules/developer";
import { orgQueries } from "@/modules/organizations";
import { userQueries } from "@/modules/users";

// Dismissed per person and organization, so it never hides another's checklist.
const dismissStorage = scopedStorage("qeetid-admin-onboarding-dismissed");

// A step is done when its existence probe matches. Any error, including a 404 from an absent
// endpoint, reads as not done, so the checklist waits instead of throwing.
function isDoneSafe<T>(
  data: T | undefined,
  err: unknown,
  predicate: (d: T) => boolean,
): boolean | "loading" {
  if (err) return false;
  if (data === undefined) return "loading";
  return predicate(data);
}

interface Step {
  id: string;
  icon: ComponentType<IconProps<"outline">>;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  done: boolean | "loading";
}

function useSteps(): Step[] {
  const tenantId = useTenantId();
  const access = useCapabilities();
  const canBrand = access.can("branding.write");
  const canInvite = access.canAll(["user.read", "user.write", "role.read"]);
  const canManageConnections = access.canAll(["connection.read", "connection.write"]);
  const canManageApiKeys = access.canAll(["apikey.read", "apikey.write"]);
  const canManageWebhooks = access.canAll(["webhook.read", "webhook.write"]);

  // Each probe shares its module's cache entry and stays quiet: a failure only leaves the step open.
  const probe = { meta: { silent: true }, staleTime: 30_000, retry: false } as const;
  const branding = useQuery({
    ...brandingQueries.detail(tenantId),
    ...probe,
    enabled: !!tenantId && canBrand,
  });
  // Two users means someone besides the owner joined.
  const users = useQuery({
    ...userQueries.list(tenantId, { limit: 2, offset: 0 }),
    ...probe,
    enabled: !!tenantId && canInvite,
  });
  const webhooks = useQuery({
    ...webhookQueries.list(tenantId),
    ...probe,
    enabled: !!tenantId && canManageWebhooks,
  });
  const oidc = useQuery({
    ...oidcClientQueries.list(tenantId),
    ...probe,
    enabled: !!tenantId && canManageConnections,
  });
  const apiKeys = useQuery({
    ...apiKeyQueries.list(tenantId),
    ...probe,
    enabled: !!tenantId && canManageApiKeys,
  });

  return [
    ...(canBrand
      ? [
          {
            id: "branding",
            icon: PaletteIcon,
            title: "Set your brand",
            description: "Upload a logo and pick your brand colours.",
            ctaLabel: "Open branding",
            ctaHref: "/settings/branding",
            done: isDoneSafe(
              branding.data,
              branding.error,
              (d) => !!(d.logo_url || d.primary_color),
            ),
          },
        ]
      : []),
    ...(canInvite
      ? [
          {
            id: "invite",
            icon: UsersIcon,
            title: "Invite your team",
            description: "Bring in admins, engineers, or support staff.",
            ctaLabel: "Invite teammates",
            ctaHref: "/invitations",
            done: isDoneSafe(users.data, users.error, (d) => (d.items?.length ?? 0) > 1),
          },
        ]
      : []),
    ...(canManageConnections
      ? [
          {
            id: "oauth-app",
            icon: ShieldCheckIcon,
            title: "Register an application",
            description: "Hook up your first OAuth/OIDC client to start signing users in.",
            ctaLabel: "Add application",
            ctaHref: "/auth/connections/oidc",
            done: isDoneSafe(oidc.data, oidc.error, (d) => (d.items?.length ?? 0) > 0),
          },
        ]
      : []),
    ...(canManageApiKeys
      ? [
          {
            id: "api-key",
            icon: KeyRoundIcon,
            title: "Create an API key",
            description: "Service-to-service auth for your backend integrations.",
            ctaLabel: "Create key",
            ctaHref: "/auth/api/keys",
            done: isDoneSafe(apiKeys.data, apiKeys.error, (d) => (d.items?.length ?? 0) > 0),
          },
        ]
      : []),
    ...(canManageWebhooks
      ? [
          {
            id: "webhook",
            icon: WebhookIcon,
            title: "Subscribe to an event webhook",
            description: "Listen for sign-ins, role changes, audit events.",
            ctaLabel: "Add webhook",
            ctaHref: "/developer/webhooks",
            done: isDoneSafe(webhooks.data, webhooks.error, (d) => (d.items?.length ?? 0) > 0),
          },
        ]
      : []),
  ];
}

// Sort steps by the segmentation-tailored order for the tenant's use case;
// unlisted steps keep their default position after the listed ones.
function tailor(steps: Step[], useCase?: string): Step[] {
  const order = useCase ? CHECKLIST_ORDER[useCase] : undefined;
  if (!order) return steps;
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i < 0 ? order.length : i;
  };
  return [...steps].sort((a, b) => rank(a.id) - rank(b.id));
}

/**
 * Renders the first-day setup tasks the operator can act on, ticked off by probing existing APIs
 * and ordered for the use case chosen at organization creation. Shows a completion card once all
 * are done; a dismissal is kept for this person and organization.
 */
export function OnboardingChecklist() {
  // The scope is known only once the session hydrates, so the stored dismissal is read with it.
  const scope = useStorageScope();
  const [dismissedIn, setDismissedIn] = useState<string | null>(null);
  const dismissed = scope !== null && (dismissedIn === scope || dismissStorage.read() === true);
  const tenantId = useTenantId();
  const tenantQ = useQuery({ ...orgQueries.record(tenantId), staleTime: 60_000 });
  const onboarding = tenantQ.data?.metadata?.onboarding as { use_case?: string } | undefined;
  const useCase = onboarding?.use_case;
  const intro = useCase ? CHECKLIST_INTRO[useCase] : undefined;
  const steps = tailor(useSteps(), useCase);

  if (dismissed) return null;
  if (steps.length === 0) return null;

  const total = steps.length;
  const doneCount = steps.filter((s) => s.done === true).length;
  const allDone = doneCount === total;
  const stillLoading = steps.some((s) => s.done === "loading");

  function handleDismiss() {
    setDismissedIn(scope);
    dismissStorage.write(true); // best-effort: without storage it lasts this page
  }

  if (allDone) {
    return (
      <Card className="border-success/25 bg-success/5 shadow-none hover:shadow-none">
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-success/10 text-success ring-1 ring-success/15">
              <PartyPopperIcon className="size-4" />
            </span>
            <div>
              <CardTitle className="text-base">Organization fully set up</CardTitle>
              <CardDescription>Every control-plane setup task is complete.</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" aria-label="Dismiss" onClick={handleDismiss}>
            <XIcon />
          </Button>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-border/80 bg-card/80 shadow-none hover:shadow-none">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-sm font-semibold">Organization readiness</CardTitle>
          <CardDescription>
            {intro ??
              (stillLoading ? "Checking your setup…" : `${doneCount} of ${total} steps complete.`)}
          </CardDescription>
          {intro && (
            <CardDescription className="text-xs">
              {stillLoading ? "Checking your setup…" : `${doneCount} of ${total} steps complete.`}
            </CardDescription>
          )}
          <div
            className="mt-3 h-1.5 w-48 max-w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Organization setup progress"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={doneCount}
          >
            <div
              className="h-full bg-primary transition-[width] duration-300 ease-(--ease-decelerate)"
              style={{ width: `${(doneCount / total) * 100}%` }}
              aria-hidden="true"
            />
          </div>
        </div>
        <Button variant="ghost" size="icon" aria-label="Dismiss" onClick={handleDismiss}>
          <XIcon />
        </Button>
      </CardHeader>
      <ul className="divide-y divide-border/70 border-t border-border/70">
        {steps.map((step) => {
          const Icon = step.icon;
          const isDone = step.done === true;
          return (
            <li
              key={step.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/25",
                isDone && "text-muted-foreground",
              )}
            >
              <div className="shrink-0">
                {isDone ? (
                  <CircleCheckIcon className="size-5 text-success" />
                ) : (
                  <CircleIcon className="size-5 text-muted-foreground/50" />
                )}
              </div>
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", isDone && "line-through")}>{step.title}</p>
                {!isDone && <p className="text-xs text-muted-foreground">{step.description}</p>}
              </div>
              {!isDone && (
                <Link
                  to={step.ctaHref}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {step.ctaLabel}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
