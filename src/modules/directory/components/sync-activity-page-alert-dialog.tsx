import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldError,
  FieldLabel,
  Input,
} from "@qeetrix/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ErrorText } from "@/platform/components/error-reference";
import { useCreateDirectoryAlert } from "../api/directory";
import type { DirectoryConnection } from "../directory-model";
import { DirectorySelect } from "./directory-ui";

/** Creates an alert that fires when a connection's failed syncs reach a threshold. */
export function DirectoryAlertDialog({
  connections,
  onClose,
}: {
  connections: DirectoryConnection[];
  onClose: () => void;
}) {
  const { t } = useTranslation("dashboard");
  const [name, setName] = useState("");
  const [connection, setConnection] = useState("");
  const [threshold, setThreshold] = useState(1);
  const mutation = useCreateDirectoryAlert();
  return (
    <Dialog open onOpenChange={(open) => !open && !mutation.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("directory.activity.createAlert")}</DialogTitle>
          <DialogDescription>{t("directory.activity.alertDescription")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim() || mutation.isPending) return;
            mutation.mutate(
              { name: name.trim(), connection_id: connection || null, threshold },
              { onSuccess: onClose },
            );
          }}
        >
          <fieldset disabled={mutation.isPending} className="space-y-4">
            <Field>
              <FieldLabel htmlFor="directory-alert-name">
                {t("directory.activity.alertName")}
              </FieldLabel>
              <Input
                id="directory-alert-name"
                value={name}
                maxLength={100}
                required
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <DirectorySelect
              label={t("directory.activity.connection")}
              value={connection}
              onChange={setConnection}
              options={[
                { value: "all", label: t("directory.allConnections") },
                ...connections.map((item) => ({ value: item.id, label: item.name })),
              ]}
            />
            <Field>
              <FieldLabel htmlFor="directory-alert-threshold">
                {t("directory.activity.threshold")}
              </FieldLabel>
              <Input
                id="directory-alert-threshold"
                type="number"
                min={1}
                max={100}
                required
                value={threshold}
                onChange={(event) => setThreshold(Number(event.target.value))}
              />
            </Field>
            {mutation.isError ? (
              <FieldError>
                <ErrorText error={mutation.error} />
              </FieldError>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("directory.cancel")}
              </Button>
              <Button type="submit" disabled={!name.trim() || mutation.isPending}>
                {t("directory.activity.createAlert")}
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
