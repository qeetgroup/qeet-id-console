// The signed-in person's own profile: name, photo and language. Reading it is platform session
// state (`useMe`); this changes it.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/platform/api/client";
import { meKeys } from "@/platform/auth/session";

export interface ProfileUpdate {
  display_name?: string;
  avatar_url?: string; // a data URL, or "" to remove the photo
  locale?: string;
}

export function useUpdateProfile() {
  const { t } = useTranslation("account");
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfileUpdate) => api<unknown>("/v1/me", { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: meKeys.all }),
    meta: { successMessage: t("profile.toast.updated"), silentError: true }, // the form shows it
  });
}
