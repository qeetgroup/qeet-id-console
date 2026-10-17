import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@qeetrix/ui";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { useCapabilities } from "@/platform/security/capability-provider";
import type { Capability } from "@/platform/security/capability-model";
import { StepUpDialog } from "@/platform/security/step-up-dialog";
import { isStepUpRequired } from "@/platform/security/step-up";
import { registerStepUpHandler } from "@/platform/security/step-up-gate";

export type SensitiveActionOptions<T> = {
  /** Optional client capability pre-check (UX only — backend stays authoritative). */
  capability?: Capability;
  /** Optional confirmation dialog shown before the action runs. */
  confirm?: {
    title: string;
    description?: string;
    confirmLabel?: string;
    tone?: "destructive" | "default";
  };
  /** Human phrase for the step-up dialog, e.g. "delete this user". */
  actionLabel?: string;
  /** The actual mutation / api() call. */
  run: () => Promise<T>;
};

type RunSensitive = <T>(options: SensitiveActionOptions<T>) => Promise<T | undefined>;

const SensitiveActionContext = createContext<RunSensitive | null>(null);

/** Thrown when the user cancels a confirm/step-up dialog. Callers can ignore it. */
export class SensitiveActionCancelled extends Error {
  constructor() {
    super("Sensitive action cancelled");
    this.name = "SensitiveActionCancelled";
  }
}

type ConfirmState = NonNullable<SensitiveActionOptions<unknown>["confirm"]> & {
  resolve: (ok: boolean) => void;
};
type StepUpState = {
  actionLabel?: string;
  /** The factor types the organisation counts; null when every one does. */
  allowedMethods: string[] | null;
  resolve: (verified: boolean) => void;
};

/**
 * Mounts the ONE shared confirm + step-up dialog for the app and exposes
 * `useSensitiveAction()`. It also registers the step-up prompt with the API
 * client (step-up-gate), so a backend `step_up_required` (403) on ANY request
 * opens the dialog and the request is sent again once the person confirms —
 * whether or not the action went through `useSensitiveAction`, which adds the
 * capability check, the confirmation and the action's wording. The backend
 * remains the authority. Mount inside CapabilityProvider.
 */
export function SensitiveActionProvider({ children }: { children: ReactNode }) {
  const { can } = useCapabilities();
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [stepUp, setStepUp] = useState<StepUpState | null>(null);
  // Keep the latest `can` without resubscribing the callback identity.
  const canRef = useRef(can);
  canRef.current = can;
  // The wording of the sensitive action running now, for the step-up dialog.
  const actionLabelRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    registerStepUpHandler(async ({ allowedMethods }) => {
      const verified = await new Promise<boolean>((resolve) => {
        setStepUp({ actionLabel: actionLabelRef.current, allowedMethods, resolve });
      });
      setStepUp(null);
      if (!verified) toast.info("Cancelled. Nothing was changed.");
      return verified;
    });
    return () => registerStepUpHandler(null);
  }, []);

  const runSensitive = useCallback<RunSensitive>(async (options) => {
    if (options.capability && !canRef.current(options.capability)) {
      toast.error("You don't have access to do that.");
      throw new SensitiveActionCancelled();
    }

    if (options.confirm) {
      const ok = await new Promise<boolean>((resolve) => {
        setConfirmState({ ...options.confirm!, resolve });
      });
      setConfirmState(null);
      if (!ok) throw new SensitiveActionCancelled();
    }

    actionLabelRef.current = options.actionLabel;
    try {
      return await options.run();
    } catch (err) {
      // The API client has already asked for the step-up and sent the request
      // again; a refusal that still reaches here is one the person cancelled.
      if (isStepUpRequired(err)) throw new SensitiveActionCancelled();
      throw err;
    } finally {
      actionLabelRef.current = undefined;
    }
  }, []);

  return (
    <SensitiveActionContext.Provider value={runSensitive}>
      {children}

      <AlertDialog
        open={!!confirmState}
        onOpenChange={(o) => {
          if (!o && confirmState) {
            confirmState.resolve(false);
            setConfirmState(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmState?.title}</AlertDialogTitle>
            {confirmState?.description && (
              <AlertDialogDescription>{confirmState.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant={confirmState?.tone ?? "destructive"}
              onClick={() => confirmState?.resolve(true)}
            >
              {confirmState?.confirmLabel ?? "Confirm"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <StepUpDialog
        open={!!stepUp}
        onOpenChange={(o) => {
          if (!o && stepUp) {
            stepUp.resolve(false);
            setStepUp(null);
          }
        }}
        onVerified={() => stepUp?.resolve(true)}
        actionLabel={stepUp?.actionLabel}
        allowedMethods={stepUp?.allowedMethods ?? null}
      />
    </SensitiveActionContext.Provider>
  );
}

/**
 * Run a sensitive action through the shared capability → confirm → step-up →
 * api pipeline. Resolves with the action's result, or rejects with
 * `SensitiveActionCancelled` if the user backs out. Non-step-up errors
 * propagate to the global handler as usual.
 */
export function useSensitiveAction(): RunSensitive {
  const ctx = useContext(SensitiveActionContext);
  if (!ctx) throw new Error("useSensitiveAction must be used inside SensitiveActionProvider");
  return ctx;
}
