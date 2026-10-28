import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { orgQueries } from "@/modules/organizations/api/orgs";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";

/** The organisation you're in, by name, for a page's copy; "your organisation" until it's read. */
export function useOrgName(): string {
  const { t } = useTranslation("organizations");
  const tenantId = useTenantId();
  const access = useCapabilities();
  const orgQ = useQuery({
    ...orgQueries.record(tenantId),
    enabled: !!tenantId && access.can("tenant.read"),
  });
  return orgQ.data?.name || t("settings.yourOrganisation");
}
