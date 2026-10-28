// Saved views for the Activity page: built-in investigations plus the person's own views.
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
  createdAt: number;
}

/** A built-in view, named by a catalogue key rather than a person's text. */
export interface PresetView extends SavedView {
  name: TranslationKey;
}

/**
 * Built-in investigations, never persisted. Each names the server's own actions (`type`, matched
 * exactly by GET /v1/activity) or category, so it finds every such event in the range rather than
 * what a word search happens to match. Failed and Critical are the page's tabs, not views.
 */
export const PRESET_VIEWS: PresetView[] = [
  {
    id: "failed-sign-ins",
    name: "activity:savedViews.preset.failedSignIns",
    builtin: true,
    search: {
      type: [
        "auth.sign_in_failed",
        "auth.sign_in_refused",
        "auth.sign_in_refused_session_limit",
        "auth.account_locked",
        "auth.address_refused",
        "auth.source_throttled",
        "auth.mfa_locked",
      ].join(","),
    },
    createdAt: 0,
  },
  {
    id: "access-changes",
    name: "activity:savedViews.preset.accessChanges",
    builtin: true,
    search: { category: "authorization" },
    createdAt: 0,
  },
  {
    id: "mfa-changes",
    name: "activity:savedViews.preset.mfaChanges",
    builtin: true,
    search: {
      type: [
        "mfa.totp_enrolled",
        "mfa.totp_disabled",
        "mfa.otp_factor_added",
        "mfa.otp_factor_removed",
        "mfa.push_device_linked",
        "mfa.push_device_unlinked",
        "mfa.push_device_revoked",
        "mfa.recovery_codes_regenerated",
        "mfa.admin_reset",
        "user.mfa_required_set",
      ].join(","),
    },
    createdAt: 0,
  },
  {
    id: "people-suspended-or-removed",
    name: "activity:savedViews.preset.suspendedOrRemoved",
    builtin: true,
    search: {
      type: [
        "user.suspended",
        "user.deleted",
        "user.purged",
        "user.removed_from_organization",
      ].join(","),
    },
    createdAt: 0,
  },
  {
    id: "security-settings",
    name: "activity:savedViews.preset.securitySettings",
    builtin: true,
    search: { category: "security" },
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

/** The filters of a search, without the open event or the applied view. */
export function viewSearch(search: ActivitySearch): ActivitySearch {
  const { event: _e, view: _v, ...filters } = search;
  return filters;
}

export const savedViewsActions = {
  add(name: string, search: ActivitySearch): SavedView {
    const view: SavedView = {
      id: makeId(name),
      name: name.trim(),
      search: viewSearch(search),
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
