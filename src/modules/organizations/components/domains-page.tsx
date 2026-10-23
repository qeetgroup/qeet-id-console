import { cn } from "@qeetrix/ui";
import { BookOpenIcon } from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { CustomLoginDomainTab } from "./custom-login-domain-tab";
import { VerifiedDomainsTab } from "./verified-domains-tab";
import { PageHeader } from "@/platform/components/page-header";

const DOCS = "https://docs.qeet.in/qeet-id/domains";

type Tab = "verified" | "custom";

/** Renders the domains settings: verified email domains and the custom sign-in domain. */
export function DomainsPage() {
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

      {/* Local state, not a route param: the two panes are one settings screen, and a URL
          segment would imply the custom-domain pane is separately linkable. */}
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
              // Tinted, as bg-background on bg-muted/40 is nearly invisible in dark mode.
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
