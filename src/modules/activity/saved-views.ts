// Saved views for the Activity workspace: built-in investigations plus the person's own views.
// A view is a set of URL search params, so applying one is a navigation.

import { Store } from "@tanstack/react-store";

import type { TranslationKey } from "@/i18n";
import { scopedStorage } from "@/platform/auth/scoped-storage";

import type { ActivitySearch } from "./activity-search";

export interface SavedView {
  id: string;
  name: string; // a built-in view's is a catalogue key; a person's own is their text
  search: ActivitySearch;
  builtin?: boolean;
  icon?: string; // Icon name such as "ShieldCheck"; the saved-views bar doesn't render it
  createdAt: number;
}

export const ALL_EVENTS_VIEW_ID = "all-events"; // The id of the unfiltered default view

/**
 * Built-in investigations, listed first and never persisted. They filter on category,
 * severity and free text, which survive renames of individual event types.
 */
/** A built-in view, named by a catalogue key rather than a person's text. */
export interface PresetView extends SavedView {
  name: TranslationKey;
}

export const PRESET_VIEWS: PresetView[] = [
  {
    id: ALL_EVENTS_VIEW_ID,
    name: "activity:savedViews.preset.allEvents",
    builtin: true,
    icon: "Activity",
    search: {},
    createdAt: 0,
  },
  {
    id: "failed-logins",
    name: "activity:savedViews.preset.failedLogins",
    builtin: true,
    icon: "LogIn",
    search: { category: "authentication", q: "login", severity: "error,critical" },
    createdAt: 0,
  },
  {
    id: "admin-actions",
    name: "activity:savedViews.preset.adminActions",
    builtin: true,
    icon: "ShieldCheck",
    search: { category: "authorization" },
    createdAt: 0,
  },
  {
    id: "mfa-changes",
    name: "activity:savedViews.preset.mfaChanges",
    builtin: true,
    icon: "Fingerprint",
    search: { category: "authentication", q: "mfa" },
    createdAt: 0,
  },
  {
    id: "security-alerts",
    name: "activity:savedViews.preset.securityAlerts",
    builtin: true,
    icon: "ShieldAlert",
    search: { severity: "critical,error" },
    createdAt: 0,
  },
  {
    id: "suspended-users",
    name: "activity:savedViews.preset.suspendedUsers",
    builtin: true,
    icon: "UserX",
    search: { q: "suspended" },
    createdAt: 0,
  },
  {
    id: "oauth-failures",
    name: "activity:savedViews.preset.oauthFailures",
    builtin: true,
    icon: "KeyRound",
    search: { category: "authentication", q: "oauth", severity: "error,critical" },
    createdAt: 0,
  },
];

export interface SavedViewsState {
  views: SavedView[];
}

export const savedViewsStore = new Store<SavedViewsState>({ views: [] });

// Views capture filters (actors, IPs, resources), so they are saved per person
// and tenant and wiped on sign-out.
const storage = scopedStorage("qeetid.activity.views", {
  onScopeChange: () => savedViewsStore.setState(() => ({ views: [] })),
});

function persist(state: SavedViewsState): void {
  storage.write(state);
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
    // A view keeps only the filters, not the open event, drawer tab or applied view.
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

/** Loads the signed-in person's views (none when signed out); re-run on storage scope change. */
export function hydrateSavedViews(): void {
  const parsed = storage.read() as Partial<SavedViewsState> | null;
  const views = Array.isArray(parsed?.views) ? (parsed.views as SavedView[]) : [];
  savedViewsStore.setState(() => ({ views }));
}
