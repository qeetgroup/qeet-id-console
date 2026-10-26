import i18n, { isTranslationKey } from "@/i18n";
import type { SearchHit, SearchItem } from "./types/registry.types";

// The heading for a hit's type, as GET /v1/search names them; a type the console doesn't know
// yet goes under a generic one.
function typeToCategory(type: string): string {
  const key = `search:resourceType.${type}`;
  return i18n.t(isTranslationKey(key) ? key : "search:resourceType.other");
}

/** Maps GET /v1/search hits to `resource` items; the status shows beside the result. */
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
