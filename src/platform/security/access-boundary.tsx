import {
  ArrowRightIcon,
  HouseIcon,
  LockKeyholeIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
} from "@qeetrix/icons";
import { Button, type QeetrixIcon, Skeleton, VisuallyHidden } from "@qeetrix/react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef } from "react";
import { Trans, useTranslation } from "react-i18next";

import { StatePage } from "@/platform/components/state-page";
import { useTenantId } from "@/platform/auth/session";
import { getRequiredCapabilityForPath } from "@/platform/security/route-capability";
import { capabilityLabel } from "./capability-model";
import { useCapabilities } from "./capability-provider";

const ROWS = [0, 1, 2, 3, 4, 5];

/** While access loads: the outline of a page header and a table, announced once. */
function AccessLoadingState() {
  const { t } = useTranslation("common");
  return (
    <div className="console-loading" role="status" aria-live="polite" aria-busy="true">
      <VisuallyHidden>{t("accessBoundary.checkingOrganizationAccess")}</VisuallyHidden>
      <div className="console-loading-head">
        <Skeleton style={{ inlineSize: "14rem", blockSize: "1.75rem" }} />
        <Skeleton style={{ inlineSize: "26rem", maxInlineSize: "80%" }} />
      </div>
      <div className="console-loading-rows">
        {ROWS.map((row) => (
          <div key={row} className="console-loading-row">
            <Skeleton variant="circle" size="md" />
            <Skeleton style={{ inlineSize: "12rem" }} />
            <Skeleton style={{ inlineSize: "7rem" }} />
          </div>
        ))}
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
  const navigate = useNavigate();
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

  const home = (label: string, icon: QeetrixIcon = HouseIcon) => (
    <Button icon={icon} onClick={() => void navigate({ to: "/" })}>
      {label}
    </Button>
  );

  if (access.state === "error") {
    return (
      <div ref={stateRef} role="alert">
        <StatePage
          tone="danger"
          icon={ShieldAlertIcon}
          title={t("accessBoundary.organizationAccessCouldNot")}
          description={t("accessBoundary.theConsoleCouldNot")}
          actions={
            <Button icon={RefreshCwIcon} onClick={access.retry}>
              {t("accessBoundary.retryAccessCheck")}
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
          <StatePage
            icon={LockKeyholeIcon}
            title={t("accessBoundary.youDonTHave")}
            description={
              <Trans
                t={t}
                i18nKey="accessBoundary.requires"
                values={{ capability: capabilityLabel(required), code: required }}
                components={{ strong: <strong />, code: <code /> }}
              />
            }
            actions={home(t("accessBoundary.goToOverview"))}
          />
        ) : (
          <StatePage
            icon={LockKeyholeIcon}
            title={t("accessBoundary.createAnOrganizationToContinue")}
            description={t("accessBoundary.thisPageBelongsTo")}
            actions={home(t("accessBoundary.goToSetup"), ArrowRightIcon)}
          />
        )}
      </div>
    );
  }

  return children;
}
