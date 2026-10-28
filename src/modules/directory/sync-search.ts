// What the Sync activity, Sync errors and Mappings addresses can narrow them to. Each route defines
// its schema from these values itself (through this module's barrel it would bring the directory's
// API into the shell); the pages' props take these types, so the two can't drift apart.

/** The period a list covers: the server reads 1 to 90 days back. */
export const PERIODS = ["7d", "30d", "90d"] as const;
export type Period = (typeof PERIODS)[number];
export const periodDays = (period: Period) => Number.parseInt(period, 10);

/** What a run ended as. The server records success or failed (never a warning) today. */
export const RESULTS = ["success", "failed"] as const;

/** `?period&connection&result&q`: the period defaults to 30 days, as the Connections band's. */
export type ActivityFilters = {
  period?: Period;
  connection?: string;
  result?: (typeof RESULTS)[number];
  q?: string;
};

/** Where a failure stands: open, marked resolved, or closed by a check that passed. */
export const RESOLUTIONS = ["open", "resolved", "retried"] as const;
export const SEVERITIES = ["critical", "warning"] as const;

/** `?period&connection&status&severity&q`: the period defaults to 90 days, the most it keeps. */
export type ErrorsFilters = {
  period?: Period;
  connection?: string;
  status?: (typeof RESOLUTIONS)[number];
  severity?: (typeof SEVERITIES)[number];
  q?: string;
};

/** `?connection`: the connection whose mappings are on show; the first one without it. */
export type MappingsFilters = { connection?: string };
