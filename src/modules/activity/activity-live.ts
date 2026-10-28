// The Activity page's live mode. The list is the audit log, read page by page; while the page is
// live it re-reads the newest events every 10 seconds, and at once when the activity stream says
// something changed. The stream itself isn't shown: it carries only the server's domain events
// (changes to groups, domains, credentials, policies and the like, not sign-ins), without the
// actor's name, device or request, under IDs the audit log doesn't know. Its audit records, read
// here, are complete and open in the event drawer like any other.

import { useQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTenantId } from "@/platform/auth/session";
import { fetchActivityPage } from "./activity-history";
import { applyFilters } from "./activity-filters";
import { activityStore } from "./activity-store";
import { acquireSubscription } from "./activity-subscription";
import { activityKeys } from "./api/keys";
import type { ActivityEvent, ActivityFilters } from "./types/activity.types";

/** How often the newest events are re-read while the page is live. */
export const LIVE_INTERVAL_MS = 10_000;
const HEAD_LIMIT = 50;
// The stream reports a change once its outbox has published it, after the audit record is written.
const NUDGE_DELAY_MS = 1_000;

export type LiveStatus = "live" | "paused" | "stalled" | "off";

export interface LiveActivity {
  /** Newer events than the list loaded, already on show at its top. */
  merged: ActivityEvent[];
  /** IDs of the events that arrived while the page was open, for their "New" mark. */
  newIds: ReadonlySet<string>;
  /** How many matching events wait to be shown (paused, or away from the first page). */
  pending: number;
  status: LiveStatus;
  /** When the person paused, for "Paused at 22:14". */
  pausedAt: number | null;
  /** When the newest events were last read, so "2 minutes ago" moves on while live. */
  checkedAt: number;
  pause: () => void;
  resume: () => void;
}

/**
 * Keeps the list current while its range runs up to now. `history` is what the list loaded,
 * newest first; `onFirstPage` says new events can go straight in at the top without moving the
 * rows under the reader. When more arrive between two reads than one read holds, `onGap` asks the
 * page to load the list again rather than show it with a hole.
 */
export function useLiveActivity({
  filters,
  history,
  enabled,
  onFirstPage,
  onGap,
}: {
  filters: ActivityFilters;
  history: readonly ActivityEvent[] | undefined;
  enabled: boolean;
  onFirstPage: boolean;
  onGap: () => void;
}): LiveActivity {
  const tenantId = useTenantId();
  // A range that ends in the past gets nothing new.
  const open = !filters.to || Date.parse(filters.to) > Date.now();
  const active = enabled && open && history !== undefined;
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const paused = pausedAt !== null;
  const [merged, setMerged] = useState<ActivityEvent[]>([]);
  const [waiting, setWaiting] = useState<ActivityEvent[]>([]);
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(() => new Set());

  // New filters: a new list, so nothing carried over.
  const filterKey = JSON.stringify(filters);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the filters change
  useEffect(() => {
    setMerged([]);
    setWaiting([]);
    setNewIds(new Set());
  }, [filterKey]);

  const head = useQuery({
    queryKey: activityKeys.head(tenantId, filters),
    queryFn: () => fetchActivityPage(filters, "", HEAD_LIMIT),
    enabled: active,
    refetchInterval: active ? LIVE_INTERVAL_MS : false,
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: 1,
    meta: { silent: true },
  });

  // The stream says something changed: read again now rather than at the next tick.
  const lastFrame = useStore(activityStore, (s) => s.lastEventId);
  useEffect(() => {
    if (!active) return;
    return acquireSubscription();
  }, [active]);
  const refetchHead = head.refetch;
  const seenFrame = useRef(lastFrame);
  useEffect(() => {
    if (!active || lastFrame === seenFrame.current) return;
    seenFrame.current = lastFrame;
    const timer = setTimeout(() => void refetchHead(), NUDGE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [active, lastFrame, refetchHead]);

  // Each read: what's newer than everything known goes in at the top, or waits.
  const known = useMemo(() => {
    const ids = new Set<string>();
    for (const e of history ?? []) ids.add(e.id);
    for (const e of merged) ids.add(e.id);
    for (const e of waiting) ids.add(e.id);
    return ids;
  }, [history, merged, waiting]);
  const knownRef = useRef(known);
  knownRef.current = known;
  const onGapRef = useRef(onGap);
  onGapRef.current = onGap;

  const headEvents = head.data?.events;
  useEffect(() => {
    if (!headEvents?.length || !history) return;
    const ids = knownRef.current;
    const fresh = headEvents.filter((e) => !ids.has(e.id));
    if (!fresh.length) return;
    if (fresh.length === headEvents.length && headEvents.length >= HEAD_LIMIT) {
      // Nothing in this read was known: there may be events between it and the list.
      onGapRef.current();
      return;
    }
    setWaiting((prev) => [...fresh, ...prev]);
    setNewIds((prev) => new Set([...prev, ...fresh.map((e) => e.id)]));
  }, [headEvents, history]);

  // Waiting events go in once the person is live and on the first page.
  useEffect(() => {
    if (paused || !onFirstPage || !waiting.length) return;
    setMerged((prev) => [...waiting, ...prev]);
    setWaiting([]);
  }, [paused, onFirstPage, waiting]);

  const pending = useMemo(() => applyFilters(waiting, filters).length, [waiting, filters]);
  const pause = useCallback(() => setPausedAt(Date.now()), []);
  const resume = useCallback(() => setPausedAt(null), []);

  const status: LiveStatus =
    !enabled || !open ? "off" : paused ? "paused" : head.isError ? "stalled" : "live";
  return {
    merged,
    newIds,
    pending,
    status,
    pausedAt,
    checkedAt: head.dataUpdatedAt,
    pause,
    resume,
  };
}
