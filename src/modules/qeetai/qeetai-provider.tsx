import { useTranslation } from "react-i18next";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { useStorageScope } from "@/platform/auth/scoped-storage";
import {
  SensitiveActionCancelled,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { StepUpDialog } from "@/platform/security/step-up-dialog";

import { hydrateConversations } from "./store/conversation-store";
import { hydrateWorkspace } from "./store/workspace-store";
import type { ConfirmRequest } from "./tools/types/tool.types";

interface QeetAIContextValue {
  /** Opens the console's confirm; resolves true on approval, false otherwise. */
  confirm: (req: ConfirmRequest) => Promise<boolean>;
  /** Opens the step-up re-auth dialog; resolves true once a fresh factor verifies. */
  stepUp: () => Promise<boolean>;
}

const QeetAIContext = createContext<QeetAIContextValue | null>(null);

/** The confirm's description: what happens, then each thing it touches ("User: Asha Rao."). */
function describe(req: ConfirmRequest): string {
  return [req.body, ...req.affected.map((item) => `${item.label}: ${item.value}.`)].join(" ");
}

/**
 * Hydrates the workspace and conversation stores on the client, never during render, and
 * provides the promise-based confirm() and stepUp() that tools wait on. The confirm is the
 * console's one (useSensitiveAction), so it looks and reads as every other.
 */
export function QeetAIRuntimeProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation("qeetai");
  const sensitive = useSensitiveAction();
  const [stepUpOpen, setStepUpOpen] = useState(false);
  // Guards against a settle-after-unmount and double-resolve on the same prompt.
  const stepUpSettleRef = useRef<((verified: boolean) => void) | null>(null);

  // History is saved per person and tenant: reload it when the scope changes, which after a
  // page reload happens only once the session hydrates.
  const storageScope = useStorageScope();
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-read on scope change
  useEffect(() => {
    hydrateConversations();
  }, [storageScope]);

  useEffect(() => hydrateWorkspace(), []);

  const confirm = useCallback(
    (req: ConfirmRequest) =>
      sensitive({
        confirm: {
          title: req.title,
          description: describe(req),
          confirmLabel: req.confirmText,
          tone: req.tone,
        },
        run: async () => true,
      }).then(
        (approved) => approved === true,
        (err: unknown) => {
          if (err instanceof SensitiveActionCancelled) return false;
          throw err;
        },
      ),
    [sensitive],
  );

  const settleStepUp = useCallback((verified: boolean) => {
    stepUpSettleRef.current?.(verified);
    stepUpSettleRef.current = null;
    setStepUpOpen(false);
  }, []);

  const stepUp = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      stepUpSettleRef.current = resolve;
      setStepUpOpen(true);
    });
  }, []);

  return (
    <QeetAIContext.Provider value={{ confirm, stepUp }}>
      {children}
      <StepUpDialog
        open={stepUpOpen}
        onOpenChange={(open) => {
          if (!open) settleStepUp(false);
        }}
        onVerified={() => settleStepUp(true)}
        actionLabel={t("qeetaiProvider.continueThisAction")}
      />
    </QeetAIContext.Provider>
  );
}

export function useQeetAIRuntime(): QeetAIContextValue {
  const value = useContext(QeetAIContext);
  if (!value) throw new Error("useQeetAIRuntime must be used inside QeetAIRuntimeProvider");
  return value;
}
