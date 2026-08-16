// Root of the qeetai runtime. Mounted once inside CapabilityProvider (so it can
// read capabilities) and inside SidebarProvider (so the docked panel can reflow
// the shell). Responsibilities:
//   • hydrate the workspace + conversation stores from storage on the client
//     (never during render — SSR output stays deterministic);
//   • expose a promise-based confirm() used by destructive tools, backed by the
//     same AlertDialog the rest of the console uses.
// The stores themselves are module singletons, so trigger/panel/launcher read
// them directly without prop-drilling; this provider only owns lifecycle + confirm.

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

import { onTokenStoreClear } from "@/platform/auth/token-store";
import { StepUpDialog } from "@/platform/security/step-up-dialog";

import { conversationActions, hydrateConversations } from "./store/conversation-store";
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

export function QeetAIRuntimeProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  // Guards against a settle-after-unmount and double-resolve on the same prompt.
  const settleRef = useRef<((approved: boolean) => void) | null>(null);
  const stepUpSettleRef = useRef<((verified: boolean) => void) | null>(null);

  useEffect(() => {
    hydrateConversations();
    const unsubscribe = hydrateWorkspace();
    // Wipe conversation history from localStorage on logout (shared machines).
    const unsubscribeClear = onTokenStoreClear(() => conversationActions.clearAll());
    return () => {
      unsubscribe?.();
      unsubscribeClear();
    };
  }, []);

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
              <AlertDialogCancel onClick={() => settle(false)}>Cancel</AlertDialogCancel>
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
        actionLabel="continue this action"
      />
    </QeetAIContext.Provider>
  );
}

export function useQeetAIRuntime(): QeetAIContextValue {
  const value = useContext(QeetAIContext);
  if (!value) throw new Error("useQeetAIRuntime must be used inside QeetAIRuntimeProvider");
  return value;
}
