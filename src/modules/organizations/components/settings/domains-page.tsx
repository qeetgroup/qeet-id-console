import { Link } from "@qeetrix/react";
import { PageContent, PageHeader } from "@qeetrix/react/experimental";
import { useTranslation } from "react-i18next";

import { PageBreadcrumb } from "@/modules/dashboard";
import { useDomains } from "@/modules/organizations/api/domains";
import { useCapabilities } from "@/platform/security/capability-provider";
import { EmailDomains } from "./email-domains";
import { SignInAddress } from "./sign-in-address";
import { useOrgName } from "./use-org-name";
import "./settings.css";

const DOCS = "https://docs.qeet.in/qeet-id/domains";

/**
 * Settings › Domains: two ruled sections on one page, not two tabs — the email domains the
 * organisation has proved it owns, and the address its people sign in at. No KPI tiles for a
 * handful of domains, no help cards: the guide is one link in the header.
 */
export function DomainsPage() {
  const { t } = useTranslation("organizations");
  const name = useOrgName();
  const access = useCapabilities();
  const verified = useDomains(access.can("connection.read")).data?.items.find(
    (d) => d.status === "verified",
  );
  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("settings.domains.title")}
        description={
          <>
            {t("settings.domains.description", { name })}{" "}
            <Link href={DOCS} external>
              {t("settings.domains.docs")}
            </Link>
          </>
        }
      />
      <PageContent width="narrow">
        <EmailDomains name={name} />
        <SignInAddress
          name={name}
          example={`auth.${verified?.domain ?? t("settings.domains.address.exampleDomain")}`}
        />
      </PageContent>
    </>
  );
}
