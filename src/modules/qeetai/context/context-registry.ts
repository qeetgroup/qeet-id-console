// Lets route pages tell the assistant what the operator is looking at (a user, a role, filters).
// Entries are keyed by pathname, so a publish from another route never leaks into the context.

import { Store, useStore } from "@tanstack/react-store";
import { useEffect } from "react";

import type { ContextSelection } from "./types/context.types";

export interface PublishedContext {
  selection?: ContextSelection;
  filters?: Record<string, string>;
}

type RegistryState = Record<string, PublishedContext>;

const registryStore = new Store<RegistryState>({});

const EMPTY: PublishedContext = {};

export function registerContext(pathname: string, value: PublishedContext) {
  registryStore.setState((s) => ({ ...s, [pathname]: value }));
}

export function clearContext(pathname: string) {
  registryStore.setState((s) => {
    if (!(pathname in s)) return s;
    const next = { ...s };
    delete next[pathname];
    return next;
  });
}

export function useContextRegistry(pathname: string): PublishedContext {
  return useStore(registryStore, (s) => s[pathname] ?? EMPTY);
}

/**
 * Publishes `value` for `pathname` while mounted and clears it on unmount. Memoize `value`: a
 * new object on every render re-publishes it.
 */
export function useRegisterContext(pathname: string, value: PublishedContext) {
  useEffect(() => {
    registerContext(pathname, value);
    return () => clearContext(pathname);
  }, [pathname, value]);
}
