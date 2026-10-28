import { ArrowRightIcon } from "@qeetrix/icons";
import { Badge, Button, Heading, Skeleton, Text } from "@qeetrix/react";
import { PageContent, PageHeader } from "@qeetrix/react/experimental";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";

import { PageBreadcrumb } from "@/modules/dashboard";
import { orgKeys } from "@/modules/organizations";
import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import { useAbacPolicies } from "@/modules/authorization/api/abac";
import { useCount } from "../lists/authz-parts";
import "../lists/authz-lists.css";

type StepUpMethod = "totp" | "recovery_code" | "otp" | "webauthn" | "push";
type StepUpSettings = { step_up_window: string; step_up_methods: StepUpMethod[] | null };

/**
 * The organisation's step-up settings, under the organisations module's own key so the cache is
 * shared with its Security policy page. Until that module's barrel exports its query options, the
 * read is repeated here (reported for the coordinator).
 */
function useStepUpSettings(enabled: boolean) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: orgKeys.securityPolicy(tenantId),
    queryFn: () => api<StepUpSettings>(`/v1/tenants/${tenantId}/policy`),
    enabled: enabled && !!tenantId,
  });
}

/**
 * Authorization › Settings: how Qeet ID decides (fixed for every organisation: the server has no
 * authorization settings), with this organisation's policies as the example, and the one related
 * control, the step-up, linked where it's set. Ruled sections of facts, as My account.
 */
export function AuthorizationSettingsPage() {
  const { t } = useTranslation("authorization");
  const n = useCount();
  const can = useCapabilities().can;
  const canPolicy = can("policy.read");
  const policies = useAbacPolicies(canPolicy).data?.items ?? [];
  const byPriority = [...policies].sort((a, b) => b.priority - a.priority);
  const top = byPriority[0];
  const last = byPriority[byPriority.length - 1];
  const stepUp = useStepUpSettings(canPolicy);

  const windowText = (value: string) => {
    const match = /^(\d+)(m|h)$/.exec(value.trim());
    if (!match) return value;
    const count = Number(match[1]);
    return match[2] === "h"
      ? t("lists.settings.confirming.hours", { count })
      : t("lists.settings.confirming.minutes", { count });
  };

  return (
    <>
      <PageHeader breadcrumb={<PageBreadcrumb />} title={t("lists.settings.title")} />
      <PageContent width="narrow">
        <div className="authz-settings">
          <Section
            title={t("lists.settings.decisions.title")}
            description={t("lists.settings.decisions.description")}
            status={<Badge size="sm">{t("lists.settings.decisions.fixed")}</Badge>}
          >
            <dl className="account-details">
              <Detail
                label={t("lists.settings.decisions.nothingLabel")}
                hint={t("lists.settings.decisions.nothingHint")}
              >
                {t("lists.settings.decisions.nothing")}
              </Detail>
              <Detail
                label={t("lists.settings.decisions.denyLabel")}
                hint={t("lists.settings.decisions.denyHint")}
              >
                {t("lists.settings.decisions.deny")}
              </Detail>
              <Detail
                label={t("lists.settings.decisions.orderLabel")}
                hint={
                  top && last && top.id !== last.id
                    ? `${t("lists.settings.decisions.orderHint")} ${t(
                        "lists.settings.decisions.orderExample",
                        {
                          top: top.name,
                          topPriority: n(top.priority),
                          last: last.name,
                          lastPriority: n(last.priority),
                        },
                      )}`
                    : t("lists.settings.decisions.orderHint")
                }
              >
                {t("lists.settings.decisions.order")}
              </Detail>
              <Detail
                label={t("lists.settings.decisions.consoleLabel")}
                hint={t("lists.settings.decisions.consoleHint")}
              >
                {t("lists.settings.decisions.console")}
              </Detail>
              <Detail
                label={t("lists.settings.decisions.missingLabel")}
                hint={t("lists.settings.decisions.missingHint")}
              >
                {t("lists.settings.decisions.missing")}
              </Detail>
              <Detail
                label={t("lists.settings.decisions.explainLabel")}
                hint={t("lists.settings.decisions.explainHint")}
                action={
                  <Go to="/authorization/simulator">
                    {t("lists.settings.decisions.openSimulator")}
                  </Go>
                }
              >
                {t("lists.settings.decisions.explain")}
              </Detail>
            </dl>
          </Section>

          <Section
            title={t("lists.settings.confirming.title")}
            description={t("lists.settings.confirming.description")}
          >
            {!canPolicy ? (
              <Text size="sm" tone="subtle" render={<p className="authz-drawer-note" />}>
                {t("lists.settings.confirming.cantRead")}
              </Text>
            ) : (
              <dl className="account-details">
                <Detail
                  label={t("lists.settings.confirming.windowLabel")}
                  hint={t("lists.settings.confirming.windowHint")}
                  action={
                    <Go to="/settings/organization/security-policy">
                      {t("lists.settings.confirming.change")}
                    </Go>
                  }
                >
                  {stepUp.data ? (
                    windowText(stepUp.data.step_up_window)
                  ) : (
                    <Skeleton className="authz-settings-skeleton" />
                  )}
                </Detail>
                <Detail label={t("lists.settings.confirming.methodsLabel")}>
                  {stepUp.data ? (
                    stepUp.data.step_up_methods?.length ? (
                      stepUp.data.step_up_methods
                        .map((m) => t(`lists.settings.confirming.methods.${m}`))
                        .join(", ")
                    ) : (
                      t("lists.settings.confirming.anyMethod")
                    )
                  ) : (
                    <Skeleton className="authz-settings-skeleton" />
                  )}
                </Detail>
              </dl>
            )}
          </Section>
        </div>
      </PageContent>
    </>
  );
}

// My account's section and fact rows (account-parts.tsx, styled by account.css), with this page's
// heading level, until findings §1.3 moves those parts to shared console code.

function Section({
  title,
  description,
  status,
  children,
}: {
  title: string;
  description?: ReactNode;
  status?: ReactNode;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <section className="account-section" aria-labelledby={id}>
      <header className="account-section-head">
        <div className="account-section-title">
          <span className="account-section-name">
            <Heading level={2} size="title-md" id={id}>
              {title}
            </Heading>
            {status}
          </span>
          {description ? (
            <Text tone="subtle" size="sm">
              {description}
            </Text>
          ) : null}
        </div>
      </header>
      {children}
    </section>
  );
}

function Detail({
  label,
  children,
  hint,
  action,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="account-detail">
      <dt>{label}</dt>
      <dd>
        <span className="account-detail-value">{children}</span>
        {hint ? <small>{hint}</small> : null}
      </dd>
      <dd className="account-detail-action">{action}</dd>
    </div>
  );
}

function Go({
  to,
  children,
}: {
  to: "/authorization/simulator" | "/settings/organization/security-policy";
  children: ReactNode;
}) {
  return (
    <Button variant="ghost" size="sm" icon={ArrowRightIcon} render={<Link to={to} />}>
      {children}
    </Button>
  );
}
