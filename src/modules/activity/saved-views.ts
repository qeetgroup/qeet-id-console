// Saved views for the Activity workspace: a built-in catalog of common security
// investigations plus user-defined views persisted to localStorage. A view is
// just a set of URL search params (ActivitySearch), so applying one is a
// navigate() and every view stays paste-shareable. TanStack Store for
// reactivity, localStorage for persistence, SSR-safe guards — same shape as the
// search feature's favorites-store.
//
// Preset facet values are best-effort against the current event taxonomy (they
// lean on category + severity + free-text `q`, which is resilient to exact
// action-name drift). Tune them as the taxonomy settles.

import { Store } from "@tanstack/react-store";

import type { ActivitySearch } from "./activity-search";

export interface SavedView {
  id: string;
  name: string;
  search: ActivitySearch;
  builtin?: boolean;
  /**
   * Optional `@qeetrix/icons` component name. Carried on the view
   * but not rendered anywhere yet — the saved-views bar draws a fixed bookmark.
   */
  icon?: string;
  createdAt: number;
}

/** The id of the "everything, no filters" default view. */
export const ALL_EVENTS_VIEW_ID = "all-events";

/** Built-in investigations. Not persisted; always shown first. */
export const PRESET_VIEWS: SavedView[] = [
  {
    id: ALL_EVENTS_VIEW_ID,
    name: "All events",
    builtin: true,
    icon: "Activity",
    search: {},
    createdAt: 0,
  },
  {
    id: "failed-logins",
    name: "Failed logins",
    builtin: true,
    icon: "LogIn",
    search: { category: "authentication", q: "login", severity: "warning,error,critical" },
    createdAt: 0,
  },
  {
    id: "admin-actions",
    name: "Admin actions",
    builtin: true,
    icon: "ShieldCheck",
    search: { category: "authorization" },
    createdAt: 0,
  },
  {
    id: "mfa-changes",
    name: "MFA changes",
    builtin: true,
    icon: "Fingerprint",
    search: { category: "authentication", q: "mfa" },
    createdAt: 0,
  },
  {
    id: "security-alerts",
    name: "Security alerts",
    builtin: true,
    icon: "ShieldAlert",
    search: { severity: "critical,error" },
    createdAt: 0,
  },
  {
    id: "suspended-users",
    name: "Suspended users",
    builtin: true,
    icon: "UserX",
    search: { q: "suspended" },
    createdAt: 0,
  },
  {
    id: "oauth-failures",
    name: "OAuth failures",
    builtin: true,
    icon: "KeyRound",
    search: { category: "authentication", q: "oauth", severity: "warning,error,critical" },
    createdAt: 0,
  },
];

const STORE_KEY = "qeetid.activity.views";

export interface SavedViewsState {
  views: SavedView[];
}

export const savedViewsStore = new Store<SavedViewsState>({ views: [] });

function persist(state: SavedViewsState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    /* best-effort */
  }
}

function makeId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "view"}-${Date.now().toString(36)}`;
}

export const savedViewsActions = {
  add(name: string, search: ActivitySearch): SavedView {
    // Strip transient params (selected event / drawer tab / applied view id)
    // so a saved view only captures the filter intent.
    const { event: _e, tab: _t, view: _v, ...filterSearch } = search;
    const view: SavedView = {
      id: makeId(name),
      name: name.trim(),
      search: filterSearch,
      createdAt: Date.now(),
    };
    savedViewsStore.setState((s) => {
      const next = { views: [view, ...s.views] };
      persist(next);
      return next;
    });
    return view;
  },

  remove(id: string): void {
    savedViewsStore.setState((s) => {
      const next = { views: s.views.filter((v) => v.id !== id) };
      persist(next);
      return next;
    });
  },

  rename(id: string, name: string): void {
    savedViewsStore.setState((s) => {
      const next = { views: s.views.map((v) => (v.id === id ? { ...v, name: name.trim() } : v)) };
      persist(next);
      return next;
    });
  },
};

export function hydrateSavedViews(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<SavedViewsState>;
    if (!parsed || !Array.isArray(parsed.views)) return;
    savedViewsStore.setState(() => ({ views: parsed.views as SavedView[] }));
  } catch {
    /* corrupt payload */
  }
}
