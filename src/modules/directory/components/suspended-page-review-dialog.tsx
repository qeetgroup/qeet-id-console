import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FieldError,
} from "@qeetrix/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  SUSPENSION_REASONS,
  type SuspendedDirectoryUser,
  type SuspensionReview,
} from "@/modules/users";
import { DirectorySelect } from "./directory-ui";

export function SuspensionReviewDialog({
  user,
  busy,
  error,
  onSave,
  onClose,
}: {
  user: SuspendedDirectoryUser;
  busy: boolean;
  error?: string;
  onSave: (input: SuspensionReview) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("dashboard");
  const [input, setInput] = useState<SuspensionReview>({
    reason: user.reason,
    risk: user.risk,
    review: user.review === "reviewed" ? "reviewed" : "pending",
  });
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("directory.suspended.review")}</DialogTitle>
          <DialogDescription>{user.display_name || user.email}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy) onSave(input);
          }}
        >
          <fieldset disabled={busy} className="space-y-4">
            <DirectorySelect
              label={t("directory.suspended.reason")}
              value={input.reason}
              onChange={(reason) => setInput({ ...input, reason })}
              options={SUSPENSION_REASONS.map((value) => ({
                value,
                label: t(`directory.suspended.reasons.${value}`),
              }))}
            />
            <DirectorySelect
              label={t("directory.suspended.risk")}
              value={input.risk}
              onChange={(risk) => setInput({ ...input, risk })}
              options={["unknown", "low", "medium", "high"].map((value) => ({
                value,
                label: t(`directory.suspended.risks.${value}`),
              }))}
            />
            <DirectorySelect
              label={t("directory.suspended.reviewState")}
              value={input.review}
              onChange={(value) => setInput({ ...input, review: value as "pending" | "reviewed" })}
              options={[
                { value: "pending", label: t("directory.suspended.pending") },
                { value: "reviewed", label: t("directory.suspended.reviewed") },
              ]}
            />
            {error ? <FieldError>{error}</FieldError> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("directory.cancel")}
              </Button>
              <Button type="submit" disabled={busy}>
                {t("directory.suspended.saveReview")}
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
