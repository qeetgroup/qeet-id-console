// Passkey data layer. The full WebAuthn flow is implemented backend-side —
// list/rename/delete plus register and login ceremonies (register/begin+finish,
// login/begin+finish via go-webauthn). list still returns [] gracefully if the
// endpoint isn't deployed, so the UI can render the "you have no passkeys yet"
// nudge without erroring out.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, api } from "@/platform/api/client";

/** One of the signed-in user's passkeys, as GET /v1/passkeys returns it. */
export interface Passkey {
  id: string;
  user_id: string;
  /**
   * User-supplied text: render it as text, never as markup. The server names
   * every new passkey (after the enrolling browser, e.g. "Chrome on macOS");
   * passkeys enrolled before that may have no name.
   */
  name?: string | null;
  transports?: string[] | null;
  created_at: string;
  last_used_at?: string | null;
}

/** The longest passkey name the server accepts, in characters. */
export const PASSKEY_NAME_MAX_LENGTH = 64;

/** Every passkey view reads this one cache entry, so a change shows everywhere. */
export const PASSKEYS_KEY = ["passkeys"] as const;

export function usePasskeys() {
  return useQuery({
    queryKey: PASSKEYS_KEY,
    queryFn: async (): Promise<{ items: Passkey[] }> => {
      try {
        return await api<{ items: Passkey[] }>("/v1/passkeys");
      } catch (err) {
        // 404 = endpoint not deployed; 501 = endpoint stubbed (ceremony
        // missing); treat both as "no passkeys" so the prompt-card
        // surface remains usable.
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
 * Renames one of the signed-in user's passkeys (PATCH /v1/passkeys/{id}). The
 * server trims and checks the name; errors are left to the caller to show
 * inline, next to the name being edited.
 */
export function useRenamePasskey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api<Passkey>(`/v1/passkeys/${encodeURIComponent(id)}`, { method: "PATCH", body: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PASSKEYS_KEY }),
    meta: { successMessage: "Passkey renamed", silentError: true },
  });
}
