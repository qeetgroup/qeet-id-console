import { useTranslation } from "react-i18next";
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
import { captureError } from "@/platform/telemetry/errors";

export type SensitiveActionOptions<T> = {
  capability?: Capability; // checked first; UX only, the backend still decides
  /** Confirmation dialog shown before the action runs. */
  confirm?: {
    title: string;
    description?: string;
    confirmLabel?: string;
    tone?: "destructive" | "default";
  };
  actionLabel?: string; // names the action in the step-up dialog, as given, e.g. "Delete user"
  run: () => Promise<T>; // the mutation or api() call itself
};

type RunSensitive = <T>(options: SensitiveActionOptions<T>) => Promise<T | undefined>;

const SensitiveActionContext = createContext<RunSensitive | null>(null);

/**
 * Thrown when the person cancels the confirmation or step-up, or lacks the capability (after a
 * toast). Callers can ignore it.
 */
export class SensitiveActionCancelled extends Error {
  constructor() {
    super("Sensitive action cancelled");
    this.name = "SensitiveActionCancelled";
  }
}

/**
 * Ends a sensitive action's promise in an event handler. A cancellation is expected, and a failed
 * mutation has already been toasted by the query client, so neither is rethrown; a failure is
 * still logged. `run` must therefore be a mutation.
 */
export function settleSensitiveAction(err: unknown): void {
  if (err instanceof SensitiveActionCancelled) return;
  captureError(err, { source: "sensitive-action" });
}

type ConfirmState = NonNullable<SensitiveActionOptions<unknown>["confirm"]> & {
  resolve: (ok: boolean) => void;
};
type StepUpState = {
  actionLabel?: string;
  allowedMethods: string[] | null; // factor types the organisation counts; null = all
  resolve: (verified: boolean) => void;
};

/**
 * Mounts the app's one confirm and step-up dialog and provides useSensitiveAction(). It also
 * registers the step-up prompt with the API client, so a `step_up_required` on any request opens
 * the dialog and resends the request once verified. Mount inside CapabilityProvider.
 */
export function SensitiveActionProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation("common");
  const { can } = useCapabilities();
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [stepUp, setStepUp] = useState<StepUpState | null>(null);
  const canRef = useRef(can); // the latest `can`, without changing runSensitive's identity
  canRef.current = can;
  const actionLabelRef = useRef<string | undefined>(undefined); // the running action's wording

  useEffect(() => {
    registerStepUpHandler(async ({ allowedMethods }) => {
      const verified = await new Promise<boolean>((resolve) => {
        setStepUp({ actionLabel: actionLabelRef.current, allowedMethods, resolve });
      });
      setStepUp(null);
      if (!verified) toast.info(t("sensitiveActionProvider.cancelledNothingWasChanged"));
      return verified;
    });
    return () => registerStepUpHandler(null);
  }, [t]);

  const runSensitive = useCallback<RunSensitive>(
    async (options) => {
      if (options.capability && !canRef.current(options.capability)) {
        toast.error(t("sensitiveActionProvider.youDonTHave"));
        throw new SensitiveActionCancelled();
      }

      const { confirm } = options;
      if (confirm) {
        const ok = await new Promise<boolean>((resolve) => {
          setConfirmState({ ...confirm, resolve });
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
    },
    [t],
  );

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
            <AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
            <Button
              variant={confirmState?.tone ?? "destructive"}
              onClick={() => confirmState?.resolve(true)}
            >
              {confirmState?.confirmLabel ?? t("actions.confirm")}
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
 * Returns a runner that takes a sensitive action through the capability check, confirmation, the
 * call and any step-up. It resolves with the result, or rejects with SensitiveActionCancelled when
 * the person backs out; other errors propagate.
 */
export function useSensitiveAction(): RunSensitive {
  const ctx = useContext(SensitiveActionContext);
  if (!ctx) throw new Error("useSensitiveAction must be used inside SensitiveActionProvider");
  return ctx;
}
