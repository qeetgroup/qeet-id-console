// Devices remembered to skip the second factor at sign-in. Unrelated to OAuth device-grant
// approvals (`useDeviceAuthorizations` in the security module).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, api } from "@/platform/api/client";

export interface TrustedDeviceSummary {
  devices: number; // One browser cookie is one device, so a laptop + phone counts as two
  users: number; // Distinct people those devices belong to
}

const EMPTY: TrustedDeviceSummary = { devices: 0, users: 0 };

export const TRUSTED_DEVICES_KEY = ["trusted-devices", "summary"] as const;

/**
 * Counts the live trusted devices in the caller's tenant. A server without the endpoint
 * (404/501) yields zeroes, not an error, so one tile can't fail the page. Expect 0 unless the
 * tenant turned on `remember_device_enabled`, which is off by default.
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

/** A device remembered so it skips the second factor at sign-in. */
export interface TrustedDevice {
  id: string;
  tenant_id: string | null; // The organisation it was remembered in
  device: string; // The device and browser in words, e.g. "Chrome on macOS"
  device_kind: "desktop" | "mobile" | "tablet" | "unknown";
  created_at: string;
  last_used_at: string | null; // When it last skipped the second factor
  expires_at: string;
  current: boolean; // The request came from this device
}

/** Whose remembered devices: the caller's own, or a member's (an administrator's view). */
export type TrustedDeviceScope = { kind: "self" } | { kind: "member"; userId: string };

function devicesPath(scope: TrustedDeviceScope): string {
  return scope.kind === "self"
    ? "/v1/auth/trusted-devices"
    : `/v1/users/${scope.userId}/trusted-devices`;
}

function devicesKey(scope: TrustedDeviceScope) {
  return ["trusted-devices", scope.kind === "self" ? "self" : scope.userId] as const;
}

/** The remembered devices in scope, newest first. */
export function useTrustedDevices(scope: TrustedDeviceScope) {
  return useQuery({
    queryKey: devicesKey(scope),
    queryFn: () => api<{ items: TrustedDevice[] }>(devicesPath(scope)),
  });
}

/** Forgets one remembered device (by id) or all of them (no id). */
export function useForgetTrustedDevices(scope: TrustedDeviceScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deviceId?: string) =>
      api<{ forgotten: number }>(
        deviceId ? `${devicesPath(scope)}/${deviceId}` : devicesPath(scope),
        {
          method: "DELETE",
        },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: devicesKey(scope) });
      void qc.invalidateQueries({ queryKey: TRUSTED_DEVICES_KEY });
    },
    meta: { silent: true },
  });
}
