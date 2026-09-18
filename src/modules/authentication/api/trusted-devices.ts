// Tenant-wide trusted-device estate (adaptive MFA "remember this device").
//
// Distinct from `useDeviceAuthorizations()` in the security module, which lists
// pending OAuth device-grant flows (TVs, CLIs waiting for approval). Same word,
// different thing.

import { useQuery } from "@tanstack/react-query";

import { ApiError, api } from "@/platform/api/client";

export interface TrustedDeviceSummary {
  /** One browser cookie is one device, so a laptop + phone counts as two. */
  devices: number;
  /** Distinct people those devices belong to. */
  users: number;
}

const EMPTY: TrustedDeviceSummary = { devices: 0, users: 0 };

export const TRUSTED_DEVICES_KEY = ["trusted-devices", "summary"] as const;

/**
 * Live trusted devices for the caller's tenant.
 *
 * Degrades to zeroes on 404/501 rather than erroring: the console and server
 * deploy independently, so a console running ahead of the API must not red-flag
 * the whole page over one tile. Mirrors `useAnalyticsOverview`.
 *
 * Expect 0 for most tenants — nothing writes a trusted device until a tenant
 * enables `remember_device_enabled`, which is off by default.
 */
export function useTrustedDeviceSummary(enabled = true) {
  return useQuery({
    queryKey: TRUSTED_DEVICES_KEY,
    enabled,
    queryFn: async () => {
      try {
        return await api<TrustedDeviceSummary>("/v1/auth/trusted-devices/count");
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 501)) return EMPTY;
        throw err;
      }
    },
    meta: { silent: true },
  });
}
