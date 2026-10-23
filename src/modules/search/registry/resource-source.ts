import type { SearchHit, SearchItem } from "./types/registry.types";

function typeToCategory(type: string): string {
  // e.g. "user" → "Users", "organization" → "Organizations"
  const s = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  return s.endsWith("s") ? s : `${s}s`;
}

/** Maps GET /v1/search hits to `resource` items, keeping status and metadata for the preview. */
export function resourceHitsToSearchItems(hits: SearchHit[]): SearchItem[] {
  return hits.map(
    (hit): SearchItem => ({
      id: `resource.${hit.type}.${hit.id}`,
      kind: "resource",
      category: typeToCategory(hit.type),
      title: hit.title,
      subtitle: hit.subtitle,
      url: hit.url,
      status: hit.status,
      updatedAt: hit.updated_at,
      metadata: hit.metadata,
      keywords: [hit.type, hit.title.toLowerCase()],
    }),
  );
}
