import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@qeetrix/ui";
import { Link, useLocation } from "@tanstack/react-router";

import { lookupNavTitle } from "@/platform/config/navigation";
import { useCapabilities } from "@/platform/security/capability-provider";

export function DynamicBreadcrumb() {
  const { pathname } = useLocation();
  const access = useCapabilities();
  const meta = lookupNavTitle(pathname);

  const lead = meta.parent // at most 2 levels: the parent for sub-items, else the group
    ? { title: meta.parent.title, url: meta.parent.url }
    : meta.group
      ? { title: meta.group }
      : null;

  return (
    <Breadcrumb className="hidden lg:block">
      <BreadcrumbList>
        {lead && (
          <>
            <BreadcrumbItem>
              {"url" in lead && lead.url && access.canAccessPath(lead.url) ? (
                <BreadcrumbLink render={<Link to={lead.url as never} />}>
                  {lead.title}
                </BreadcrumbLink>
              ) : (
                <span className="text-muted-foreground">{lead.title}</span>
              )}
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        )}
        <BreadcrumbItem>
          <BreadcrumbPage>{meta.title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
