import type { TFunction } from "i18next";
import type { ReactNode } from "react";

import type { Capability } from "@/platform/security/capability-model";

export type SearchItemKind = "navigation" | "command" | "resource" | "recent" | "favorite";

export interface QuickAction {
  id: string;
  label: string;
  icon?: ReactNode;
  run(ctx: SearchContext): void;
}

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
  updatedAt?: string; // ISO 8601, shown in the preview pane
  metadata?: Record<string, string>;
  /** Runs the item; without it, selecting the item navigates to `url`. */
  run?(ctx: SearchContext): void;
  quickActions?: QuickAction[];
}

export interface SearchContext {
  pathname: string;
  tenantId: string | null;
  capabilities: ReadonlySet<string>; // The person's current permission strings
  navigate(url: string): void;
  t: TFunction; // translates item copy in the current language
}

export interface SearchSource {
  id: string;
  getItems(query: string, ctx: SearchContext): SearchItem[];
}

export type SearchResultGroup = {
  category: string;
  items: SearchItem[];
};

/** One hit from GET /v1/search. */
export type SearchHit = {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  status?: string;
  updated_at?: string;
  score: number;
  metadata?: Record<string, string>;
};

export type SearchResponse = {
  results: SearchHit[];
  next_cursor?: string;
};
