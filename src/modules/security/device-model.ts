// Device sign-ins (RFC 8628) as the page reads them: what each request became. A code lasts 10
// minutes (oidc.deviceCodeTTL); the server keeps "pending" on a lapsed one, so the page calls it
// expired itself. Once approved, the device's next poll spends the code for its tokens; the list
// doesn't say whether it has (no `consumed_at`), so an approved one isn't offered a revoke.

import type { DeviceAuth } from "./api/device-auth";

export const DEVICE_STATES = ["waiting", "approved", "denied", "expired"] as const;
export type DeviceState = (typeof DEVICE_STATES)[number];

/** The list's address: `?q=…&status=waiting&app=<client_id>`. */
export type DeviceFilters = { q?: string; status?: DeviceState; app?: string };

export function deviceState(d: DeviceAuth, now: number): DeviceState {
  if (d.status === "authorized") return "approved";
  if (d.status === "denied") return "denied";
  return Date.parse(d.expires_at) > now ? "waiting" : "expired";
}

export function matchesDevice(d: DeviceAuth, filters: DeviceFilters, now: number): boolean {
  if (filters.status && deviceState(d, now) !== filters.status) return false;
  if (filters.app && d.client_id !== filters.app) return false;
  const q = filters.q?.trim().toLowerCase();
  if (q && !`${d.user_code} ${d.user_email}`.toLowerCase().includes(q)) return false;
  return true;
}

const DAY = 24 * 60 * 60 * 1000;

/** Requests a day over the last `days`, oldest first. */
export function requestsPerDay(items: readonly DeviceAuth[], now: number, days = 14): number[] {
  const out = Array<number>(days).fill(0);
  for (const d of items) {
    const age = Math.floor((now - Date.parse(d.created_at)) / DAY);
    if (age >= 0 && age < days) out[days - 1 - age] = (out[days - 1 - age] ?? 0) + 1;
  }
  return out;
}
