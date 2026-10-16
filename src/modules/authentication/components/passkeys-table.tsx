import {
  Badge,
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@qeetrix/ui";
import { CheckIcon, PencilIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { errorMessage } from "@/platform/errors/user-message";
import { PASSKEY_NAME_MAX_LENGTH, type Passkey } from "../api/passkeys";

/**
 * The name to show for a passkey. Passkeys enrolled before the server named
 * every new one have none and get `unnamed` (a translated label) instead.
 */
export function passkeyDisplayName(passkey: Passkey, unnamed: string): string {
  return passkey.name?.trim() || unnamed;
}

type PasskeysTableProps = {
  passkeys: Passkey[];
  /** Saves a new name. Resolve to close the editor; a rejection is shown inline. */
  onRename: (passkey: Passkey, name: string) => Promise<unknown>;
  /** Called when the user asks to remove a passkey — the caller confirms. */
  onRemove: (passkey: Passkey) => void;
  isRemoving?: boolean;
};

/**
 * The signed-in user's passkeys (name · transports · last used · created ·
 * actions) with an inline rename. Names are user-supplied, so they are only
 * ever rendered as text.
 */
export function PasskeysTable({ passkeys, onRename, onRemove, isRemoving }: PasskeysTableProps) {
  const { t } = useTranslation("auth");
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The server trims and counts characters (not UTF-16 units); match it so
  // Save is only offered for a name it will accept.
  const draft = editing?.draft.trim() ?? "";
  const draftLength = Array.from(draft).length;
  const draftValid = draftLength > 0 && draftLength <= PASSKEY_NAME_MAX_LENGTH;

  function startRename(passkey: Passkey) {
    setEditing({ id: passkey.id, draft: passkey.name ?? "" });
    setError(null);
  }

  function cancelRename() {
    setEditing(null);
    setError(null);
  }

  async function saveRename(passkey: Passkey) {
    if (!draftValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onRename(passkey, draft);
      setEditing(null);
    } catch (e) {
      // errorMessage maps the code to safe copy — never the backend's text.
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("loginMethods.passkeys.columns.name")}</TableHead>
          <TableHead>{t("loginMethods.passkeys.columns.transports")}</TableHead>
          <TableHead>{t("loginMethods.passkeys.columns.lastUsed")}</TableHead>
          <TableHead>{t("loginMethods.passkeys.columns.created")}</TableHead>
          <TableHead className="text-right">{t("loginMethods.passkeys.columns.actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {passkeys.map((p) => {
          const isEditing = editing?.id === p.id;
          return (
            <TableRow key={p.id}>
              <TableCell className="font-medium">
                {isEditing ? (
                  <form
                    className="flex flex-col gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveRename(p);
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <Input
                        value={editing.draft}
                        onChange={(e) => setEditing({ id: p.id, draft: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") cancelRename();
                        }}
                        aria-label={t("loginMethods.passkeys.rename.label")}
                        aria-invalid={!draftValid || !!error}
                        placeholder={t("loginMethods.passkeys.rename.placeholder")}
                        maxLength={PASSKEY_NAME_MAX_LENGTH}
                        className="h-8 max-w-xs"
                        autoFocus
                      />
                      <Button
                        type="submit"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t("loginMethods.passkeys.rename.save")}
                        disabled={!draftValid || saving}
                      >
                        <CheckIcon className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t("loginMethods.passkeys.rename.cancel")}
                        onClick={cancelRename}
                      >
                        <XIcon className="size-4" />
                      </Button>
                    </div>
                    {error ? (
                      <p role="alert" className="text-xs font-normal text-destructive">
                        {error}
                      </p>
                    ) : null}
                  </form>
                ) : p.name?.trim() ? (
                  <span className="block max-w-xs truncate" title={p.name}>
                    {p.name}
                  </span>
                ) : (
                  <span className="italic font-normal text-muted-foreground">
                    {t("loginMethods.passkeys.unnamed")}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {(p.transports ?? []).map((transport) => (
                    <Badge key={transport} variant="muted">
                      {transport}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {p.last_used_at
                  ? new Date(p.last_used_at).toLocaleString()
                  : t("loginMethods.passkeys.lastUsedNever")}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(p.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startRename(p)}
                  disabled={isEditing}
                >
                  <PencilIcon /> {t("loginMethods.passkeys.renameBtn")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onRemove(p)} disabled={isRemoving}>
                  <Trash2Icon /> {t("loginMethods.passkeys.removeBtn")}
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
