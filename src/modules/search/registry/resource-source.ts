import type { TFunction } from "i18next";

import i18n from "@/i18n";
import type { SearchHit, SearchItem } from "./types/registry.types";

// The heading for a hit's type, as GET /v1/search names them; a type the console doesn't know
// yet goes under a generic one.
function typeToCategory(type: string, t: TFunction): string {
  const key = `search:resourceType.${type}`;
  return t(i18n.exists(key) ? key : "search:resourceType.other");
}

/** Maps GET /v1/search hits to `resource` items, keeping status and metadata for the preview. */
export function resourceHitsToSearchItems(hits: SearchHit[], t: TFunction): SearchItem[] {
  return hits.map(
    (hit): SearchItem => ({
      id: `resource.${hit.type}.${hit.id}`,
      kind: "resource",
      category: typeToCategory(hit.type, t),
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
