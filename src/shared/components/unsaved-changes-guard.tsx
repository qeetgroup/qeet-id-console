import { Button, Dialog, DialogContent, DialogFooter } from "@qeetrix/react";
import { useBlocker } from "@tanstack/react-router";

type UnsavedChangesGuardProps = {
  when: boolean; // there are unsaved changes to lose
  title: string;
  description: string;
  stayLabel: string;
  leaveLabel: string;
};

/**
 * Asks before navigating away from unsaved changes, in the app and on a reload or tab close. The
 * dialog is open exactly while the router holds the navigation. Leaving loses the changes, so it's
 * a danger alert dialog: only its buttons close it, and Stay comes first.
 */
export function UnsavedChangesGuard({
  when,
  title,
  description,
  stayLabel,
  leaveLabel,
}: UnsavedChangesGuardProps) {
  const blocker = useBlocker({
    shouldBlockFn: () => when,
    enableBeforeUnload: when,
    withResolver: true,
  });
  return (
    <Dialog
      open={blocker.status === "blocked"}
      intent="danger"
      onOpenChange={(open) => {
        if (!open) blocker.reset?.();
      }}
    >
      <DialogContent title={title} description={description} size="md">
        <DialogFooter>
          <Button variant="ghost" onClick={() => blocker.reset?.()}>
            {stayLabel}
          </Button>
          <Button tone="danger" onClick={() => blocker.proceed?.()}>
            {leaveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
