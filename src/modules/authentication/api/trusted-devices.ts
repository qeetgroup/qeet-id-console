// Devices remembered to skip the second factor at sign-in. Unrelated to OAuth device-grant
// approvals (`useDeviceAuthorizations` in the security module).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { userKeys } from "@/modules/users";
import { backend } from "@/platform/api/backend";
import { ApiError } from "@/platform/api/client";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";
import { authKeys } from "./keys";

export interface TrustedDeviceSummary {
  devices: number; // One browser cookie is one device, so a laptop + phone counts as two
  users: number; // Distinct people those devices belong to
}

const EMPTY: TrustedDeviceSummary = { devices: 0, users: 0 };

/**
 * Counts the live trusted devices in the caller's tenant. A server without the endpoint
 * (404/501) yields zeroes, not an error, so one tile can't fail the page. Expect 0 unless the
 * tenant turned on `remember_device_enabled`, which is off by default.
 */
export function useTrustedDeviceSummary(enabled = true) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: authKeys.trustedDeviceCount(organizationId),
    enabled,
    queryFn: async () => {
      try {
        return await backend.get("/v1/auth/trusted-devices/count");
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 501)) return EMPTY;
        throw err;
      }
    },
    meta: { silent: true },
  });
}

/**
 * A device remembered so it skips the second factor at sign-in: in words ("Chrome on macOS"), the
 * organization it was remembered in, when it last skipped the second factor, and whether the
 * request came from it.
 */
export type TrustedDevice = Answer<"/v1/auth/trusted-devices">["items"][number];

/** Whose remembered devices: the caller's own, or a member's (an administrator's view). */
export type TrustedDeviceScope = { kind: "self" } | { kind: "member"; userId: string };

function readDevices(scope: TrustedDeviceScope): Promise<{ items: TrustedDevice[] }> {
  return scope.kind === "self"
    ? backend.get("/v1/auth/trusted-devices")
    : backend.get("/v1/users/{id}/trusted-devices", {
        path: { id: scope.userId },
      });
}

/** Forgets one device (by id) or every one in scope; answers how many it forgot. */
function forgetDevices(scope: TrustedDeviceScope, deviceId?: string) {
  if (scope.kind === "self") {
    return deviceId
      ? backend.delete("/v1/auth/trusted-devices/{id}", { path: { id: deviceId } })
      : backend.delete("/v1/auth/trusted-devices");
  }
  return deviceId
    ? backend.delete("/v1/users/{id}/trusted-devices/{deviceID}", {
        path: { id: scope.userId, deviceID: deviceId },
      })
    : backend.delete("/v1/users/{id}/trusted-devices", { path: { id: scope.userId } });
}

// A member's devices sit with the rest of that person's views.
function devicesKey(organizationId: string | null, scope: TrustedDeviceScope) {
  return scope.kind === "self"
    ? authKeys.trustedDevices()
    : [...userKeys.user(organizationId, scope.userId), "trusted-devices"];
}

/** The remembered devices in scope, newest first. */
export function useTrustedDevices(scope: TrustedDeviceScope) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: devicesKey(organizationId, scope),
    queryFn: () => readDevices(scope),
  });
}

/** Forgets one remembered device (by id) or all of them (no id). */
export function useForgetTrustedDevices(scope: TrustedDeviceScope) {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deviceId?: string) => forgetDevices(scope, deviceId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: devicesKey(organizationId, scope) });
      void qc.invalidateQueries({ queryKey: authKeys.trustedDeviceCount(organizationId) });
    },
    meta: { silent: true },
  });
}
