import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/platform/errors/api-error";
import { normalizeError } from "@/platform/errors/normalize-error";
import { userMessageForCode } from "@/platform/errors/user-message";

interface MutationMeta {
  silent?: boolean; // drops both toasts, as for a background poll
  silentError?: boolean; // drops only the error toast, for a screen that shows it itself
  successMessage?: string; // replaces the default "Saved"
  successDescription?: string; // a second line for the success toast
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
    toast.error(atLimit ? "Plan limit reached" : "Upgrade to unlock this", {
      description: atLimit
        ? "You've reached your plan's limit. Upgrade to add more."
        : "This feature isn't included in your plan. Upgrade to unlock it.",
      action: {
        label: "Upgrade",
        onClick: () => {
          window.location.href = "/settings/billing";
        },
      },
    });
    return;
  }
  if (error.status === 401 || error.status === 400 || error.status === 422) return;
  // The API client has already prompted for the step-up; a refusal that still lands here was
  // cancelled, and the generic 403 toast would mislead.
  if (error.code === "step_up_required") return;
  if (error.status === 403) {
    toast.error("This action is no longer available", {
      description: "Your organization access may have changed. The console is refreshing it now.",
    });
    return;
  }
  // Leak stop: curated copy for the code, never the backend message.
  const appError = normalizeError(error);
  toast.error(userMessageForCode(appError.code, appError.kind));
}

// Toasts every mutation that doesn't opt out; the default "Saved" is generic on purpose.
function reportSuccess(meta?: MutationMeta) {
  if (meta?.silent) return;
  toast.success(meta?.successMessage ?? "Saved", {
    description: meta?.successDescription,
  });
}

export function getContext() {
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
