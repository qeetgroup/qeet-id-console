// The signed-in person's own profile: name, photo and language. Reading it is platform session
// state (`useMe`); this changes it.

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { backend } from "@/platform/api/backend";
import type { Body } from "@/platform/api/contract";
import { meKeys } from "@/platform/auth/session";

/** What the person may change: their name, photo (a data URL, or "" to remove it) and language. */
export type ProfileUpdate = Pick<Body<"/v1/me", "patch">, "display_name" | "avatar_url" | "locale">;

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfileUpdate) => backend.patch("/v1/me", { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: meKeys.all }),
    meta: { successMessage: "account:profile.toast.updated", silentError: true }, // the form shows it
  });
}
