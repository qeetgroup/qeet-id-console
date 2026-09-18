import type { EligibleOrganization } from "@/platform/auth/organization-selection";

export type OrganizationSort = "recent" | "name" | "name-desc";

export function organizationLastUsed(organization: EligibleOrganization): number {
  const timestamp = organization.last_used_at ? Date.parse(organization.last_used_at) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function mostRecentOrganization(organizations: EligibleOrganization[]): string | null {
  let recent: EligibleOrganization | undefined;
  for (const organization of organizations) {
    if (organizationLastUsed(organization) > (recent ? organizationLastUsed(recent) : 0))
      recent = organization;
  }
  return recent?.id ?? null;
}

export function filterOrganizations(
  organizations: EligibleOrganization[],
  search: string,
  role: string,
  sort: OrganizationSort,
  locale: string,
) {
  const needle = search.trim().toLocaleLowerCase(locale);
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
  return organizations
    .filter(
      (organization) =>
        (!needle ||
          [organization.name, organization.slug, organization.domain].some((value) =>
            value.toLocaleLowerCase(locale).includes(needle),
          )) &&
        (!role || organization.roles.includes(role)),
    )
    .sort((first, second) => {
      const names = collator.compare(first.name, second.name) || first.id.localeCompare(second.id);
      if (sort === "name-desc") return -names;
      if (sort === "name") return names;
      return organizationLastUsed(second) - organizationLastUsed(first) || names;
    });
}

export function organizationInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "?"
  );
}

export function organizationImage(source?: string | null): string | undefined {
  if (!source) return undefined;
  if (source.startsWith("/") && !source.startsWith("//") && !source.includes("\\")) return source;
  if (/^data:image\/(png|jpeg|webp|svg\+xml);base64,/i.test(source)) return source;
  try {
    const url = new URL(source);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
