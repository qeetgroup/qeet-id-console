// Phones linked for sign-in approval (the Qeet Auth mobile app), and the
// one-time pairing code that links one without copying an access token.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";

/** A phone that can approve sign-ins. */
export interface PushDevice {
  id: string;
  name: string;
  platform: "ios" | "android";
  /** When it was linked (or last linked again). */
  created_at: string;
  last_seen_at: string;
}

/** Whose phones: the caller's own, or a member's (an administrator's view). */
export type PushDeviceScope = { kind: "self" } | { kind: "member"; userId: string };

function devicesPath(scope: PushDeviceScope): string {
  return scope.kind === "self" ? "/v1/mfa/push/devices" : `/v1/users/${scope.userId}/push-devices`;
}

function devicesKey(scope: PushDeviceScope) {
  return ["push-devices", scope.kind === "self" ? "self" : scope.userId] as const;
}

/** The linked phones in scope. */
export function usePushDevices(scope: PushDeviceScope) {
  return useQuery({
    queryKey: devicesKey(scope),
    queryFn: () => api<{ items: PushDevice[] }>(devicesPath(scope)),
  });
}

/** Removes a linked phone: it stops approving sign-ins at once. */
export function useRemovePushDevice(scope: PushDeviceScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: string) =>
      api<void>(`${devicesPath(scope)}/${deviceId}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: devicesKey(scope) });
      // The member page counts linked phones in its security summary.
      void qc.invalidateQueries({ queryKey: ["user360", "security"] });
    },
    meta: { silent: true },
  });
}

/** A pairing code: it links one phone, once, before it expires. */
export interface PushPairing {
  id: string;
  /** Shown only when issued, grouped for reading ("ABCDE-FGHJK"). */
  code?: string;
  status: "pending" | "linked" | "expired";
  expires_at: string;
  /** The phone it linked. */
  device_id?: string;
}

/**
 * What the pairing QR code holds: a link that opens Qeet Auth on the phone
 * with the code filled in. The app can also scan it, or the code can be typed.
 */
export function pairingLink(code: string): string {
  return `qeetidauth://pair?code=${encodeURIComponent(code)}`;
}

/** Asks for a pairing code for the caller's own account (needs a step-up). */
export function useStartPairing() {
  return useMutation({
    mutationFn: () =>
      api<PushPairing & { code: string }>("/v1/mfa/push/pairing", { method: "POST" }),
    meta: { silent: true },
  });
}

/** Watches a pairing code until it links a phone or expires. */
export function usePairingStatus(id: string | null) {
  return useQuery({
    queryKey: ["push-pairing", id],
    enabled: id !== null,
    queryFn: () => api<PushPairing>(`/v1/mfa/push/pairing/${id}`),
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 2000 : false),
    meta: { silent: true },
  });
}

/** Stops an unused pairing code working, as when its dialog closes. */
export function useWithdrawPairing() {
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/mfa/push/pairing/${id}`, { method: "DELETE" }),
    meta: { silent: true },
  });
}
