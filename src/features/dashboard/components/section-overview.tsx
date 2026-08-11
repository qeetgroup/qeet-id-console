import { Badge, buttonVariants } from "@qeetrix/ui";
import { PageState } from "@qeetrix/ui/blocks";
import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, LayoutGridIcon } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { filterNavigation, type NavItem, navGroups } from "@/config/navigation";
import { useCapabilities } from "@/features/access-control/capability-provider";
import { useTenantId } from "@/lib/auth";

type SectionOverviewProps = {
  /** The navigation group label this page is the overview for. */
  group: string;
  /** This overview's own URL, so it isn't listed as one of its own cards. */
  overviewUrl: string;
  /** One-line summary shown under the page title. */
  description: string;
};

/**
 * A section landing page: one card per navigable area in the section, generated
 * straight from the navigation config so it can never drift from the sidebar.
 * Cards (and their listed sub-areas) respect the caller's capabilities.
 */
export function SectionOverview({ group, overviewUrl, description }: SectionOverviewProps) {
  const access = useCapabilities();
  const hasOrg = !!useTenantId();

  const visibleGroup = filterNavigation(navGroups, access.can).find((g) => g.label === group);
  const items = (visibleGroup?.items ?? []).filter((item) => item.url !== overviewUrl);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader description={description} />

      {items.length === 0 ? (
        <section className="enterprise-panel">
          <PageState
            icon={LayoutGridIcon}
            title={hasOrg ? `No ${group.toLowerCase()} areas are available` : "Create an organization first"}
            description={
              hasOrg
                ? "Your organization role doesn't include access to these areas. Ask an organization administrator if you need it."
                : "These tools appear once you create or join an organization."
            }
            actions={
              <Link to="/" className={buttonVariants()}>
                Go to {hasOrg ? "overview" : "setup"}
              </Link>
            }
          />
        </section>
      ) : (
        <section className="enterprise-panel" aria-labelledby="section-overview-title">
          <header className="enterprise-panel-header items-center">
            <div>
              <h2 id="section-overview-title" className="font-heading text-base font-semibold">
                {group}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Jump to any area in {group.toLowerCase()}.
              </p>
            </div>
            <Badge variant="muted" className="shrink-0 tabular-nums">
              {items.length} areas
            </Badge>
          </header>
          <nav aria-label={`${group} areas`} className="grid md:grid-cols-2">
            {items.map((item) => (
              <SectionCard key={item.url} item={item} />
            ))}
          </nav>
        </section>
      )}
    </div>
  );
}

function SectionCard({ item }: { item: NavItem }) {
  // Sub-areas are shown as text (not nested links) — the card itself is the
  // anchor, and an anchor can't contain other anchors.
  const subAreas = item.items?.map((sub) => sub.title).join(" · ");

  return (
    <Link
      to={item.url as never}
      className="group flex min-h-28 items-start gap-4 border-t border-border/70 p-5 outline-none transition-colors duration-150 hover:bg-muted/35 focus-visible:bg-muted/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:odd:border-e"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground ring-1 ring-foreground/6 transition-colors group-hover:text-foreground [&_svg]:size-4">
        {item.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-sm font-semibold">{item.title}</span>
        {item.description ? (
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            {item.description}
          </span>
        ) : null}
        {subAreas ? (
          <span className="mt-2 block text-[11px] leading-5 text-muted-foreground/80">
            {subAreas}
          </span>
        ) : null}
      </span>
      <ChevronRightIcon className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
    </Link>
  );
}
