import { Avatar } from "@qeetrix/react";
import { useQuery } from "@tanstack/react-query";

import { orgQueries } from "@/modules/organizations";
import { useTenantId } from "@/platform/auth/session";

/**
 * The organisation in the top bar's scope path: always its name, never a control. Switching lives
 * in the account menu. Nothing shows before an organisation exists.
 */
export function ScopeName() {
  const tenantId = useTenantId();
  const org = useQuery({ ...orgQueries.list(), enabled: !!tenantId }).data?.items.find(
    (item) => item.id === tenantId,
  );
  if (!org) return null;
  return (
    <span className="frame-scope">
      {/* Initials only: a logo is a URL the organisation sets, and the bar is on every page. */}
      <Avatar name={org.name} shape="square" size="sm" decorative />
      <span className="frame-scope-name">{org.name}</span>
    </span>
  );
}
