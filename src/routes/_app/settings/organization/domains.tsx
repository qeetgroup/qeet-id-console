import { cn } from "@qeetrix/ui";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpenIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { CustomLoginDomainTab } from "@/modules/organizations/components/custom-login-domain-tab";
import { VerifiedDomainsTab } from "@/modules/organizations/components/verified-domains-tab";
import { PageHeader } from "@/platform/components/page-header";

export const Route = createFileRoute("/_app/settings/organization/domains")({
  component: DomainsPage,
});

const DOCS = "https://docs.qeet.in/qeet-id/domains";

type Tab = "verified" | "custom";

function DomainsPage() {
  const { t } = useTranslation("settings");
  const [tab, setTab] = useState<Tab>("verified");

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <PageHeader description={t("workspace.domains.description")} />
        <div className="flex shrink-0 items-start gap-3 rounded-xl border bg-card p-4 xl:w-80">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <BookOpenIcon className="size-4.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t("workspace.domains.help.title")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("workspace.domains.help.detail")}
            </p>
            <a
              href={DOCS}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {t("workspace.domains.help.cta")} →
            </a>
          </div>
        </div>
      </div>

      {/* Tabs as a segmented control with local state, not a route param: the
          two panes are one settings screen, and a URL segment would imply the
          custom-domain pane is separately linkable. */}
      <div
        role="tablist"
        aria-label={t("workspace.domains.description")}
        className="inline-flex w-fit items-center gap-1 rounded-lg border bg-muted/40 p-1"
      >
        {(["verified", "custom"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              // The selected pill is tinted rather than just a lighter grey:
              // bg-background against bg-muted/40 is nearly indistinguishable in
              // dark mode, so the active tab was invisible there.
              tab === id
                ? "bg-primary/12 font-semibold text-primary ring-1 ring-primary/25"
                : "font-medium text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
          >
            {t(`workspace.domains.tabs.${id}`)}
          </button>
        ))}
      </div>

      {tab === "verified" ? <VerifiedDomainsTab /> : <CustomLoginDomainTab />}
    </div>
  );
}
