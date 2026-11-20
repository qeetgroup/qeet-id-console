// The Analytics report's reads: sign-ins, the people signing in and failed sign-ins over a chosen
// range and the period before it, from the audit log's summary (GET /v1/activity/summary,
// audit.read), which takes any window up to 90 days. The analytics overview has fixed windows
// only. Page-only, so the shell doesn't carry it.

import { keepPreviousData, useQueries } from "@tanstack/react-query";
import { useOrganizationId } from "@/platform/auth/session";
import { dashboardKeys } from "./keys";
import { backend } from "@/platform/api/backend";

type Summary = {
  total: number;
  unique_actors: number;
  series: { at: string; count: number }[];
};

/**
 * Switching to the organisation, creating it and accepting an invitation to it each record a
 * sign-in with no factor of its own; the analytics overview leaves them out of sign-in counts.
 * The summary can't filter on the method, so its search leaves out events that name them.
 */
const MOVE_METHODS = [
  "organization_switch",
  "organization_create",
  "tenant_switch", // events recorded before the server's rename
  "tenant_create",
  "invite_accept",
];
// Each excluded as a quoted phrase: the search splits a word at "_", and only a phrase keeps the
// two halves together, where a bare -tenant_switch would require "switch" on every event.
const NOT_SIGN_INS = MOVE_METHODS.map((method) => `-"${method}"`).join(" ");

const SIGN_INS = { types: "auth.login_succeeded", q: NOT_SIGN_INS };
// People are counted from every sign-in event, switching included, as the overview's MAU is.
const PEOPLE = { types: "auth.login_succeeded" };
const FAILED = { types: "auth.sign_in_failed" };

export type RangeReport = {
  signIns: Summary;
  people: Summary;
  failed: Summary;
  previousSignIns: Summary;
  previousPeople: Summary;
  previousFailed: Summary;
};

/** Each series for the range (`from`, open-ended) and the period before it (`previousFrom`–`previousTo`). */
export function useRangeReport(
  period: { from: string; previousFrom: string; previousTo: string },
  enabled = true,
) {
  const organizationId = useOrganizationId();
  const reads = [
    { ...SIGN_INS, from: period.from },
    { ...PEOPLE, from: period.from },
    { ...FAILED, from: period.from },
    { ...SIGN_INS, from: period.previousFrom, to: period.previousTo },
    { ...PEOPLE, from: period.previousFrom, to: period.previousTo },
    { ...FAILED, from: period.previousFrom, to: period.previousTo },
  ];
  return useQueries({
    queries: reads.map((query) => ({
      queryKey: [...dashboardKeys.organization(organizationId), "range", query],
      queryFn: () => backend.get("/v1/activity/summary", { query: { ...query, bucket: 86_400 } }),
      enabled: !!organizationId && enabled,
      staleTime: 60_000,
      placeholderData: keepPreviousData,
      meta: { silent: true },
    })),
    combine: (results) => {
      const [signIns, people, failed, previousSignIns, previousPeople, previousFailed] =
        results.map((r) => r.data);
      const data =
        signIns && people && failed && previousSignIns && previousPeople && previousFailed
          ? { signIns, people, failed, previousSignIns, previousPeople, previousFailed }
          : undefined;
      return {
        data: data as RangeReport | undefined,
        loading: results.some((r) => r.isLoading),
        // A new range shows the last one's numbers, dimmed, until its own arrive.
        refreshing: results.some((r) => r.isPlaceholderData),
        error: results.find((r) => r.error)?.error ?? null,
        retry: () => {
          for (const r of results) if (r.error) void r.refetch();
        },
      };
    },
  });
}
