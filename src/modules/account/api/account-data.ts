// The signed-in person's own data: a portable export, and erasing the account.

import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/platform/api/client";
import { sessionStore } from "@/platform/auth/session-store";
import { downloadBlob } from "@/shared/utils/data-export";

/** Downloads the person's portable data as a JSON file. */
export function useExportAccount() {
  const { t } = useTranslation("account");
  return useMutation({
    mutationFn: async () => {
      const data = await api<Record<string, unknown>>("/v1/account/export", { method: "POST" });
      downloadBlob(
        JSON.stringify(data, null, 2),
        "application/json",
        `qeet-id-account-export-${new Date().toISOString().slice(0, 10)}.json`,
      );
    },
    meta: { successMessage: t("data.export.done") },
  });
}

/**
 * Erases the account: personal data and credentials go at once (audit references stay, redacted)
 * and every session ends, so the person leaves the console. An account with a password confirms
 * it.
 */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: (password: string | null) =>
      api<void>("/v1/account/delete", {
        method: "POST",
        body: password === null ? {} : { password },
      }),
    onSuccess: () => {
      sessionStore.clear();
      window.location.assign("/sign-up");
    },
    meta: { silent: true }, // the page shows a refusal, and success leaves the console
  });
}
