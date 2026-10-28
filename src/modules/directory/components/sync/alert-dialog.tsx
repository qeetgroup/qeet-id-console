import { BellPlusIcon } from "@qeetrix/icons";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  Field,
  Select,
  TextField,
} from "@qeetrix/react";
import { Alert, NumberField } from "@qeetrix/react/experimental";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCreateDirectoryAlert } from "@/modules/directory/api/sync";
import type { DirectoryConnection } from "@/modules/directory/directory-model";
import { ErrorReference } from "@/platform/components/error-reference";
import { errorMessage } from "@/platform/errors/user-message";
import { ANY, useConnectionNames } from "./sync-parts";

/**
 * Alert me: a console notice for the person making it when a connection's failures (or any
 * connection's) in 15 minutes reach a number, at most one every 15 minutes (the server's
 * notifyAlerts). Failed LDAP sign-ins count, so a low number on a busy directory is noisy. The
 * server keeps no list of alerts the console could show or remove (a server gap), so the dialog
 * says so.
 */
export function AlertDialog({
  open,
  onOpenChange,
  connections,
  connectionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connections: readonly DirectoryConnection[];
  /** The connection the list is narrowed to, as the alert's first choice. */
  connectionId?: string;
}) {
  const { t } = useTranslation("directory");
  const nameOf = useConnectionNames(connections);
  const create = useCreateDirectoryAlert();
  const [connection, setConnection] = useState(ANY);
  const [threshold, setThreshold] = useState<number | null>(3);
  const [name, setName] = useState("");
  const [named, setNamed] = useState(false); // the person typed their own title
  const [nameError, setNameError] = useState<string>();

  const defaultName = (id: string) =>
    id ? t("activity.alert.nameDefaultFor", { name: nameOf(id) }) : t("activity.alert.nameDefault");

  // Each time it opens: the list's connection, a threshold of 3, and a title that follows them.
  useEffect(() => {
    if (!open) return;
    const id = connectionId && connections.some((c) => c.id === connectionId) ? connectionId : ANY;
    setConnection(id);
    setThreshold(3);
    setName("");
    setNamed(false);
    setNameError(undefined);
    create.reset();
  }, [open, connectionId, connections, create.reset]);

  const title = named ? name : defaultName(connection);
  const busy = create.isPending;

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) return setNameError(t("activity.alert.nameRequired"));
    if (threshold === null || threshold < 1 || threshold > 100) return;
    create.mutate(
      { name: trimmed.slice(0, 100), connection_id: connection || null, threshold },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!busy || next) && onOpenChange(next)}>
      <DialogContent
        size="md"
        title={t("activity.alert.title")}
        description={t("activity.alert.description")}
      >
        <DialogBody>
          <form
            id="directory-alert"
            className="sub-form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy) submit();
            }}
          >
            {create.isError ? (
              <Alert tone="danger" title={errorMessage(create.error)}>
                <ErrorReference error={create.error} />
              </Alert>
            ) : null}
            <Field label={t("activity.alert.connection")}>
              <Select
                value={connection}
                onValueChange={(value) => setConnection(value ? String(value) : ANY)}
                items={[
                  { value: ANY, label: t("activity.alert.anyConnection") },
                  ...connections.map((c) => ({ value: c.id, label: nameOf(c.id) })),
                ]}
              />
            </Field>
            <Field
              label={t("activity.alert.threshold")}
              description={t("activity.alert.thresholdHelp")}
            >
              <NumberField value={threshold} onValueChange={setThreshold} min={1} max={100} />
            </Field>
            <TextField
              label={t("activity.alert.name")}
              description={nameError ? undefined : t("activity.alert.nameHelp")}
              error={nameError}
              value={title}
              maxLength={100}
              autoComplete="off"
              onValueChange={(value) => {
                setName(value);
                setNamed(true);
                if (nameError) setNameError(undefined);
              }}
            />
            <Alert tone="info" title={t("activity.alert.onlyYou")}>
              {t("activity.alert.onlyYouDetail")}
            </Alert>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("activity.alert.cancel")}
          </Button>
          <Button type="submit" form="directory-alert" icon={BellPlusIcon} loading={busy}>
            {t("activity.alert.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
