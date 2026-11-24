// Phones linked for sign-in approval (Qeet ID on the phone), and the
// one-time pairing code that links one without copying an access token.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { userKeys } from "@/modules/users";
import { backend } from "@/platform/api/backend";
import type { Schemas } from "@/platform/api/contract";
import { useOrganizationId, useUserId } from "@/platform/auth/session";
import { isOneOf } from "@/shared/utils/one-of";
import { authKeys } from "./keys";

/** A phone that can approve sign-ins: when it was linked (or last linked again), and last seen. */
export type PushDevice = Schemas<"access">["PushDevice"];

const PLATFORMS = ["ios", "android"] as const;

/** A phone's platform as the console knows it; the document leaves it a free string. */
export const pushPlatform = (platform: string): (typeof PLATFORMS)[number] | "other" =>
  isOneOf(PLATFORMS, platform) ? platform : "other";

/** Whose phones: the caller's own, or a member's (an administrator's view). */
export type PushDeviceScope = { kind: "self" } | { kind: "member"; userId: string };

function readDevices(scope: PushDeviceScope): Promise<{ items: PushDevice[] }> {
  return scope.kind === "self"
    ? backend.get("/v1/mfa/push/devices")
    : backend.get("/v1/users/{id}/push-devices", {
        path: { id: scope.userId },
      });
}

// A member's phones sit with the rest of that person's views.
function devicesKey(organizationId: string | null, scope: PushDeviceScope) {
  return scope.kind === "self"
    ? authKeys.pushDevices()
    : [...userKeys.user(organizationId, scope.userId), "push-devices"];
}

/** The linked phones in scope. */
export function usePushDevices(scope: PushDeviceScope) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: devicesKey(organizationId, scope),
    queryFn: () => readDevices(scope),
  });
}

/** Removes a linked phone: it stops approving sign-ins at once. */
export function useRemovePushDevice(scope: PushDeviceScope) {
  const organizationId = useOrganizationId();
  const ownId = useUserId();
  const qc = useQueryClient();
  const userId = scope.kind === "member" ? scope.userId : ownId;
  return useMutation({
    mutationFn: (deviceId: string) =>
      scope.kind === "self"
        ? backend.delete("/v1/mfa/push/devices/{id}", { path: { id: deviceId } })
        : backend.delete("/v1/users/{id}/push-devices/{deviceID}", {
            path: { id: scope.userId, deviceID: deviceId },
          }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: devicesKey(organizationId, scope) });
      // The member page counts linked phones in its security summary.
      if (userId)
        void qc.invalidateQueries({ queryKey: userKeys.view(organizationId, userId, "security") });
    },
    meta: { silent: true },
  });
}

/** A pairing code: it links one phone, once, before it expires. */
export interface PushPairing {
  id: string;
  code?: string; // Shown only when issued, grouped for reading ("ABCDE-FGHJK")
  status: "pending" | "linked" | "expired";
  expires_at: string;
  device_id?: string; // The phone it linked
}

/**
 * Returns what the pairing QR code holds: a link that opens Qeet ID on the phone with the code
 * filled in. The app can also scan it, or the code can be typed.
 */
export function pairingLink(code: string): string {
  return `qeetidauth://pair?code=${encodeURIComponent(code)}`;
}

/** Asks for a pairing code for the caller's own account (needs a step-up). */
export function useStartPairing() {
  return useMutation({
    mutationFn: () => backend.post("/v1/mfa/push/pairing"),
    meta: { silent: true },
  });
}

/** Watches a pairing code until it links a phone or expires. */
export function usePairingStatus(id: string | null) {
  return useQuery({
    queryKey: authKeys.pushPairing(id),
    enabled: id !== null,
    queryFn: () => backend.get("/v1/mfa/push/pairing/{id}", { path: { id: id ?? "" } }),
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 2000 : false),
    meta: { silent: true },
  });
}

/** Stops an unused pairing code working, as when its dialog closes. */
export function useWithdrawPairing() {
  return useMutation({
    mutationFn: (id: string) => backend.delete("/v1/mfa/push/pairing/{id}", { path: { id } }),
    meta: { silent: true },
  });
}
