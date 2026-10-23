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

import { useStorageScope } from "@/platform/auth/scoped-storage";
import { StepUpDialog } from "@/platform/security/step-up-dialog";

import { hydrateConversations } from "./store/conversation-store";
import { hydrateWorkspace } from "./store/workspace-store";
import type { ConfirmRequest } from "./tools/types/tool.types";

interface QeetAIContextValue {
  /** Opens a confirmation dialog; resolves true on approval, false otherwise. */
  confirm: (req: ConfirmRequest) => Promise<boolean>;
  /** Opens the step-up re-auth dialog; resolves true once a fresh factor verifies. */
  stepUp: () => Promise<boolean>;
}

const QeetAIContext = createContext<QeetAIContextValue | null>(null);

interface PendingConfirm {
  req: ConfirmRequest;
  resolve: (approved: boolean) => void;
}

/**
 * Hydrates the workspace and conversation stores on the client, never during render, and
 * provides the promise-based confirm() and stepUp() dialogs that tools wait on.
 */
export function QeetAIRuntimeProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation("qeetai");
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  // Guards against a settle-after-unmount and double-resolve on the same prompt.
  const settleRef = useRef<((approved: boolean) => void) | null>(null);
  const stepUpSettleRef = useRef<((verified: boolean) => void) | null>(null);

  // History is saved per person and tenant: reload it when the scope changes, which after a
  // page reload happens only once the session hydrates.
  const storageScope = useStorageScope();
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-read on scope change
  useEffect(() => {
    hydrateConversations();
  }, [storageScope]);

  useEffect(() => hydrateWorkspace(), []);

  const settle = useCallback((approved: boolean) => {
    settleRef.current?.(approved);
    settleRef.current = null;
    setPending(null);
  }, []);

  const confirm = useCallback((req: ConfirmRequest) => {
    return new Promise<boolean>((resolve) => {
      settleRef.current = resolve;
      setPending({ req, resolve });
    });
  }, []);

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

  const req = pending?.req;

  return (
    <QeetAIContext.Provider value={{ confirm, stepUp }}>
      {children}
      <AlertDialog open={!!pending} onOpenChange={(open) => !open && settle(false)}>
        {req ? (
          <AlertDialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100%-2rem)] overflow-y-auto sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>{req.title}</AlertDialogTitle>
              <AlertDialogDescription>{req.body}</AlertDialogDescription>
            </AlertDialogHeader>
            {req.affected.length > 0 ? (
              <ul className="flex min-w-0 flex-col gap-1.5 rounded-md border bg-muted/30 p-3 text-sm">
                {req.affected.map((item) => (
                  <li
                    key={`${item.label}:${item.value}`}
                    className="flex min-w-0 items-center justify-between gap-4"
                  >
                    <span className="shrink-0 text-muted-foreground">{item.label}</span>
                    <span className="min-w-0 truncate font-medium" title={item.value}>
                      {item.value}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => settle(false)}>
                {t("common:actions.cancel")}
              </AlertDialogCancel>
              <Button
                variant={req.tone === "destructive" ? "destructive" : "default"}
                onClick={() => settle(true)}
              >
                {req.confirmText}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>
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
