import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@qeetrix/ui";
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
 * dialog is open exactly while the router holds the navigation.
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
    <AlertDialog
      open={blocker.status === "blocked"}
      onOpenChange={(open) => {
        if (!open) blocker.reset?.();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => blocker.reset?.()}>
            {stayLabel}
          </Button>
          <Button variant="destructive" onClick={() => blocker.proceed?.()}>
            {leaveLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
