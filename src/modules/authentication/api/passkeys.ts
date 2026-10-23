import {
  type PublicKeyCredentialCreationOptionsJSON,
  startRegistration,
} from "@simplewebauthn/browser";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { ApiError, api } from "@/platform/api/client";

import { refreshSignInMethods } from "./sign-in-methods";
import { authKeys } from "./keys";

const passkeySchema = z.object({
  id: z.string(),
  user_id: z.string(),
  // User-supplied text: render it as text, never as markup. The server names a new passkey after
  // the enrolling browser (e.g. "Chrome on macOS"); older passkeys may have no name.
  name: z.string().nullish(),
  transports: z.array(z.string()).nullish(),
  created_at: z.string(),
  last_used_at: z.string().nullish(),
});
/** One of the signed-in user's passkeys, as GET /v1/passkeys returns it. */
export type Passkey = z.infer<typeof passkeySchema>;

const passkeyListSchema = z.object({
  items: z.array(passkeySchema),
  // False when the user's organization has passkeys switched off; the server then refuses to add
  // one. Absent means allowed.
  enrollment_allowed: z.boolean().optional(),
});
/** GET /v1/passkeys: the user's passkeys and whether they may add one. */
export type PasskeyList = z.infer<typeof passkeyListSchema>;

/** Returns the signed-in user's passkeys, rejecting a response that isn't a passkey list. */
export function listPasskeys(): Promise<PasskeyList> {
  return api("/v1/passkeys", { schema: passkeyListSchema });
}

/** Whether to offer adding a passkey, once the list has loaded. */
export function canAddPasskey(list: PasskeyList | undefined): boolean {
  return list !== undefined && list.enrollment_allowed !== false;
}

/** The longest passkey name the server accepts, in characters. */
export const PASSKEY_NAME_MAX_LENGTH = 64;

export function usePasskeys() {
  return useQuery({
    queryKey: authKeys.passkeys(),
    queryFn: async (): Promise<PasskeyList> => {
      try {
        return await listPasskeys();
      } catch (err) {
        // A server without passkey support (404/501) means "no passkeys", so the prompt card
        // still renders.
        if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
          return { items: [] };
        }
        throw err;
      }
    },
    staleTime: 60_000,
    meta: { silent: true },
    retry: false,
  });
}

/**
 * Renames one of the signed-in user's passkeys. The server trims and checks the name; errors are
 * left to the caller to show inline, next to the name being edited.
 */
export function useRenamePasskey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api<Passkey>(`/v1/passkeys/${encodeURIComponent(id)}`, { method: "PATCH", body: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.passkeys() }),
    meta: { successMessage: "auth:toast.passkeyRenamed", silentError: true },
  });
}

/**
 * Adds a passkey for the signed-in user: the server's creation options, the
 * browser's WebAuthn prompt, then the attestation back. Without a name (or a
 * blank one) the server names it after this browser, e.g. "Chrome on macOS";
 * it can be renamed afterwards. Errors are left to the caller.
 */
export function useRegisterPasskey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name?: string } | undefined) => {
      const begin = await api<{
        session_id: string;
        publicKey: PublicKeyCredentialCreationOptionsJSON;
      }>("/v1/passkeys/register/begin", { method: "POST" });
      const credential = await startRegistration({ optionsJSON: begin.publicKey });
      const name = input?.name?.trim();
      await api<void>("/v1/passkeys/register/finish", {
        method: "POST",
        body: { session_id: begin.session_id, credential, ...(name ? { name } : {}) },
      });
    },
    onSuccess: () => {
      void refreshSignInMethods(qc);
      return qc.invalidateQueries({ queryKey: authKeys.passkeys() });
    },
    meta: { silent: true },
  });
}

/** Removes one of the signed-in user's passkeys. */
export function useRemovePasskey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/v1/passkeys/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => {
      void refreshSignInMethods(qc);
      return qc.invalidateQueries({ queryKey: authKeys.passkeys() });
    },
    meta: { successMessage: "auth:toast.passkeyRemoved" },
  });
}
