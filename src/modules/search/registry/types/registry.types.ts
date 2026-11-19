import type { ReactNode } from "react";

import type { Answer } from "@/platform/api/contract";
import type { Capability } from "@/platform/security/capability-model";

export type SearchItemKind = "navigation" | "command" | "resource" | "recent" | "favorite";

export interface SearchItem {
  id: string; // Stable unique key across all sources
  kind: SearchItemKind;
  category: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  keywords?: string[];
  url?: string;
  capability?: Capability;
  status?: string; // A well-known status, rendered by StatusPill
  updatedAt?: string; // ISO 8601
  metadata?: Record<string, unknown>;
  /** Runs the item; without it, selecting the item navigates to `url`. */
  run?(ctx: SearchContext): void;
}

export interface SearchContext {
  pathname: string;
  organizationId: string | null;
  capabilities: ReadonlySet<string>; // The person's current permission strings
  navigate(url: string): void;
  language: string | undefined; // the items' language: a change rebuilds them
}

export interface SearchSource {
  id: string;
  getItems(query: string, ctx: SearchContext): SearchItem[];
}

export type SearchResultGroup = {
  category: string;
  items: SearchItem[];
};

/** What GET /v1/search answers, and one hit in it. */
export type SearchResponse = Answer<"/v1/search">;
export type SearchHit = SearchResponse["results"][number];
