// Filter and selection state for the identity timeline; the events live in TanStack Query.
// Held in memory only, so it outlives the page within the tab but not a reload.

import { Store } from "@tanstack/react-store";

import type { Severity } from "@/modules/activity";

export interface TimelineFilters {
  category: string[]; // Empty matches every category
  severity: Severity[]; // Empty matches every severity
  q: string; // Full-text search, debounced before it reaches the API
  from: string; // ISO 8601 lower bound; empty for none
  to: string; // ISO 8601 upper bound; empty for none
}

export const DEFAULT_TIMELINE_FILTERS: TimelineFilters = {
  category: [],
  severity: [],
  q: "",
  from: "",
  to: "",
};

export interface TimelineStoreState {
  filters: TimelineFilters;
  selectedEventId: string | null; // The event open in the details drawer
}

export const timelineStore = new Store<TimelineStoreState>({
  filters: DEFAULT_TIMELINE_FILTERS,
  selectedEventId: null,
});

export const timelineActions = {
  setFilters(patch: Partial<TimelineFilters>) {
    timelineStore.setState((s) => ({
      ...s,
      filters: { ...s.filters, ...patch },
    }));
  },

  resetFilters() {
    timelineStore.setState((s) => ({
      ...s,
      filters: DEFAULT_TIMELINE_FILTERS,
    }));
  },

  setSelectedEventId(id: string | null) {
    timelineStore.setState((s) => ({ ...s, selectedEventId: id }));
  },

  clearSelection() {
    timelineStore.setState((s) => ({ ...s, selectedEventId: null }));
  },
};
