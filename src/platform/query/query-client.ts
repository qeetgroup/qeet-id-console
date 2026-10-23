import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import i18n from "@/i18n";
import { ApiError } from "@/platform/errors/api-error";
import { toastError } from "@/platform/errors/error-toast";

interface MutationMeta {
  silent?: boolean; // drops both toasts, as for a background poll
  silentError?: boolean; // drops only the error toast, for a screen that shows it itself
  successMessage?: string; // a catalogue key ("<ns>:toast.<key>") replacing the default "Saved"
  successDescription?: string; // a catalogue key for a second line
}

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: MutationMeta;
    queryMeta: { silent?: boolean };
  }
}

// Toasts backend errors in one place. A 401 has already sent the person to /sign-in, and
// 400/422 are left to inline form messages.
function reportError(error: unknown, meta?: Record<string, unknown>) {
  if (meta?.silent || meta?.silentError) return;
  if (!(error instanceof ApiError)) return;
  // Plan limits get an actionable Upgrade toast, keyed on the code so neither the status (402)
  // nor the 403 branch below can mask it.
  if (error.code === "billing.plan_limit" || error.code === "billing.upgrade_required") {
    const atLimit = error.code === "billing.plan_limit";
    toast.error(
      i18n.t(atLimit ? "errors:toast.planLimitTitle" : "errors:toast.upgradeRequiredTitle"),
      {
        description: i18n.t(
          atLimit ? "errors:toast.planLimitDescription" : "errors:toast.upgradeRequiredDescription",
        ),
        action: {
          label: i18n.t("errors:toast.upgrade"),
          onClick: () => {
            window.location.href = "/settings/billing";
          },
        },
      },
    );
    return;
  }
  if (error.status === 401 || error.status === 400 || error.status === 422) return;
  // The API client has already prompted for the step-up; a refusal that still lands here was
  // cancelled, and the generic 403 toast would mislead.
  if (error.code === "step_up_required") return;
  if (error.status === 403) {
    toast.error(i18n.t("errors:toast.accessChangedTitle"), {
      description: i18n.t("errors:toast.accessChangedDescription"),
    });
    return;
  }
  toastError(error);
}

// Toasts every mutation that doesn't opt out; the default "Saved" is generic on purpose.
function reportSuccess(meta?: MutationMeta) {
  if (meta?.silent) return;
  toast.success(i18n.t(meta?.successMessage ?? "common:toast.saved"), {
    description: meta?.successDescription ? i18n.t(meta.successDescription) : undefined,
  });
}

/** What every route can read from the router context: the app's one query client. */
export type RouterContext = { queryClient: QueryClient };

export function getContext(): RouterContext {
  let queryClient: QueryClient;
  const refreshCapabilities = (error: unknown, sourceQueryKey?: readonly unknown[]) => {
    if (!(error instanceof ApiError) || error.status !== 403) return;
    if (sourceQueryKey?.[0] === "effective-permissions") return;
    queueMicrotask(() => {
      void queryClient.invalidateQueries({ queryKey: ["effective-permissions"] });
    });
  };

  queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        reportError(error, query.meta);
        refreshCapabilities(error, query.queryKey);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        reportError(error, mutation.meta);
        refreshCapabilities(error);
      },
      onSuccess: (_data, _vars, _ctx, mutation) =>
        reportSuccess(mutation.meta as MutationMeta | undefined),
    }),
  });

  return {
    queryClient,
  };
}
export default function TanstackQueryProvider() {}
