import { Button, buttonVariants, Skeleton } from "@qeetrix/ui";
import { Link, useLocation } from "@tanstack/react-router";
import { LockKeyholeIcon, RefreshCwIcon, ShieldAlertIcon } from "@qeetrix/icons";
import type { ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useEffect, useRef } from "react";

import { useTenantId } from "@/platform/auth/session";
import { getRequiredCapabilityForPath } from "@/platform/security/route-capability";
import { PageState } from "@/shared/components/page-state";
import { capabilityLabel } from "./capability-model";
import { useCapabilities } from "./capability-provider";

function AccessLoadingState() {
  const { t } = useTranslation("common");
  return (
    <div className="flex min-w-0 flex-col gap-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{t("accessBoundary.checkingOrganizationAccess")}</span>
      <div className="flex items-end justify-between gap-4 border-b border-border/70 pb-5">
        <div className="space-y-3">
          <Skeleton className="h-8 w-56 max-w-[70vw]" />
          <Skeleton className="h-4 w-96 max-w-[80vw]" />
        </div>
        <Skeleton className="hidden h-9 w-28 sm:block" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-36 lg:col-span-2" />
        <Skeleton className="h-36" />
        <Skeleton className="h-72 lg:col-span-3" />
      </div>
    </div>
  );
}

function focusStateHeading(root: HTMLDivElement | null) {
  const heading = root?.querySelector<HTMLHeadingElement>("h1");
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}

export function AccessBoundary({ children }: { children: ReactNode }) {
  const { t } = useTranslation("common");
  const { pathname } = useLocation();
  const access = useCapabilities();
  const hasOrg = !!useTenantId();
  const stateRef = useRef<HTMLDivElement>(null);
  const required = getRequiredCapabilityForPath(pathname);
  const denied = access.state === "ready" && required !== undefined && !access.can(required);
  const deniedPath = denied ? pathname : null;
  const focusKey = access.state === "error" ? `error:${pathname}` : deniedPath;

  useEffect(() => {
    if (focusKey) focusStateHeading(stateRef.current);
  }, [focusKey]);

  if (access.state === "resolving") return <AccessLoadingState />;

  if (access.state === "error") {
    return (
      <div ref={stateRef} role="alert">
        <PageState
          code="—"
          icon={ShieldAlertIcon}
          title={t("accessBoundary.organizationAccessCouldNot")}
          description={t("accessBoundary.theConsoleCouldNot")}
          actions={
            <Button onClick={access.retry}>
              <RefreshCwIcon /> {t("accessBoundary.retryAccessCheck")}
            </Button>
          }
        />
      </div>
    );
  }

  if (denied && required) {
    // An org-less user is denied for want of an organization, not a role: point them at
    // onboarding rather than at an admin.
    return (
      <div ref={stateRef}>
        {hasOrg ? (
          <PageState
            code="403"
            icon={LockKeyholeIcon}
            title={t("accessBoundary.youDonTHave")}
            description={
              <>
                <Trans
                  t={t}
                  i18nKey="accessBoundary.requires"
                  values={{ capability: capabilityLabel(required) }}
                  components={{ strong: <strong /> }}
                />
                <span className="mt-1 block font-mono text-xs">{required}</span>
              </>
            }
            actions={
              <Link to="/" className={buttonVariants()}>
                {t("accessBoundary.goToOverview")}
              </Link>
            }
          />
        ) : (
          <PageState
            code="—"
            icon={LockKeyholeIcon}
            title={t("accessBoundary.createAnOrganizationToContinue")}
            description={t("accessBoundary.thisPageBelongsTo")}
            actions={
              <Link to="/" className={buttonVariants()}>
                {t("accessBoundary.goToSetup")}
              </Link>
            }
          />
        )}
      </div>
    );
  }

  return children;
}
