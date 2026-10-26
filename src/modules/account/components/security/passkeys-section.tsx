import { FingerprintPatternIcon, PlusIcon } from "@qeetrix/icons";
import { Button, TextField } from "@qeetrix/react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  canAddPasskey,
  isLastSignInMethod,
  isStepUpRequired,
  type Passkey,
  PASSKEY_NAME_MAX_LENGTH,
  passkeyDisplayName,
  usePasskeys,
  useRegisterPasskey,
  useRemovePasskey,
  useRenamePasskey,
  useSignInMethods,
} from "@/modules/authentication";
import { errorMessage } from "@/platform/errors/user-message";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { relative } from "@/modules/account/relative-time";
import { Failure, Item, LoadFailed, Loading, Panel, Section } from "../account-parts";

/**
 * The person's passkeys: add one (when their organisation allows it), rename it where it's
 * listed, or remove it unless it's the last way to sign in.
 */
export function PasskeysSection() {
  const { t } = useTranslation("account");
  const runSensitive = useSensitiveAction();
  const passkeys = usePasskeys();
  const remove = useRemovePasskey();
  // The server refuses removing the last way to sign in; say so before the button is pressed.
  const lastMethod = isLastSignInMethod(useSignInMethods().data);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const items = passkeys.data?.items ?? [];
  const canAdd = canAddPasskey(passkeys.data);
  const unnamed = t("security.passkeys.unnamed");

  const removeOne = (passkey: Passkey) =>
    runSensitive({
      confirm: {
        title: t("security.passkeys.removeConfirm", { name: passkeyDisplayName(passkey, unnamed) }),
        description: t("security.passkeys.removeDescription"),
        confirmLabel: t("security.remove"),
        tone: "destructive",
      },
      actionLabel: t("security.passkeys.removeAction"),
      run: () => remove.mutateAsync(passkey.id),
    }).catch(settleSensitiveAction);

  return (
    <Section
      title={t("security.passkeys.title")}
      description={t("security.passkeys.description")}
      action={
        canAdd &&
        !adding && (
          <Button variant="soft" icon={PlusIcon} onClick={() => setAdding(true)}>
            {t("security.passkeys.add")}
          </Button>
        )
      }
    >
      {passkeys.isPending ? (
        <Loading />
      ) : passkeys.isError ? (
        <LoadFailed error={passkeys.error} onRetry={() => void passkeys.refetch()} />
      ) : (
        <>
          {(adding || items.length > 0) && (
            <ul className="account-rows">
              {adding && <AddPasskey onClose={() => setAdding(false)} />}
              {items.map((passkey) => {
                const name = passkeyDisplayName(passkey, unnamed);
                return renaming === passkey.id ? (
                  <RenamePasskey
                    key={passkey.id}
                    passkey={passkey}
                    onDone={() => setRenaming(null)}
                  />
                ) : (
                  <Item
                    key={passkey.id}
                    icon={<FingerprintPatternIcon />}
                    name={name}
                    line={
                      passkey.last_used_at
                        ? t("security.passkeys.lineUsed", {
                            added: relative(passkey.created_at),
                            used: relative(passkey.last_used_at),
                          })
                        : t("security.passkeys.line", { added: relative(passkey.created_at) })
                    }
                    actions={
                      <>
                        <Button
                          variant="ghost"
                          aria-label={t("security.passkeys.renameNamed", { name })}
                          onClick={() => setRenaming(passkey.id)}
                        >
                          {t("security.passkeys.rename")}
                        </Button>
                        <Button
                          variant="ghost"
                          aria-label={t("security.removeNamed", { name })}
                          disabled={
                            lastMethod || (remove.isPending && remove.variables === passkey.id)
                          }
                          title={lastMethod ? t("security.lastMethod") : undefined}
                          onClick={() => void removeOne(passkey)}
                        >
                          {t("security.remove")}
                        </Button>
                      </>
                    }
                  />
                );
              })}
            </ul>
          )}
          {!adding && items.length === 0 && (
            <p className="account-note">
              {canAdd ? t("security.passkeys.empty") : t("security.passkeys.disabled")}
            </p>
          )}
          {items.length > 0 && !canAdd && passkeys.isSuccess && (
            <p className="account-note">{t("security.passkeys.disabled")}</p>
          )}
        </>
      )}
    </Section>
  );
}

/** Adding one: an optional name, then the browser's own prompt. A dismissed prompt isn't an error. */
function AddPasskey({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("account");
  const runSensitive = useSensitiveAction();
  const register = useRegisterPasskey();
  const [name, setName] = useState("");
  const [failure, setFailure] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    runSensitive({
      actionLabel: t("security.passkeys.add"),
      run: () =>
        register.mutateAsync(
          { name },
          {
            onError: (err) =>
              setFailure(
                isStepUpRequired(err)
                  ? null
                  : err instanceof Error && err.name === "NotAllowedError"
                    ? t("security.passkeys.cancelled")
                    : errorMessage(err),
              ),
          },
        ),
    })
      .then(() => {
        toast.success(t("security.passkeys.added"));
        onClose();
      })
      .catch(settleSensitiveAction);
  }

  return (
    <Panel
      as="li"
      title={t("security.passkeys.addTitle")}
      description={t("security.passkeys.addDescription")}
    >
      <form className="account-panel-form" noValidate onSubmit={submit}>
        <TextField
          label={t("security.passkeys.nameLabel")}
          optional
          description={t("security.passkeys.nameHint")}
          placeholder={t("security.passkeys.namePlaceholder")}
          maxLength={PASSKEY_NAME_MAX_LENGTH}
          autoComplete="off"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        {failure && <Failure>{failure}</Failure>}
        <span className="account-panel-actions">
          <Button size="lg" type="submit" loading={register.isPending}>
            {register.isPending ? t("security.passkeys.adding") : t("security.passkeys.create")}
          </Button>
          <Button variant="ghost" size="lg" onClick={onClose}>
            {t("cancel")}
          </Button>
        </span>
      </form>
    </Panel>
  );
}

/** Renaming one where it's listed: its name becomes a field, its actions Cancel and Save. */
function RenamePasskey({ passkey, onDone }: { passkey: Passkey; onDone: () => void }) {
  const { t } = useTranslation("account");
  const rename = useRenamePasskey();
  const [name, setName] = useState(passkey.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const formId = `rename-${passkey.id}`;

  function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    const next = name.trim();
    if (!next) return setError(t("security.passkeys.nameRequired"));
    if (next === passkey.name?.trim()) return onDone();
    rename.mutate(
      { id: passkey.id, name: next },
      { onSuccess: onDone, onError: (err) => setFailure(errorMessage(err)) },
    );
  }

  return (
    <li className="account-row" data-editing="">
      <span className="account-icon" aria-hidden="true">
        <FingerprintPatternIcon />
      </span>
      <form id={formId} noValidate onSubmit={submit}>
        <TextField
          label={t("security.passkeys.nameLabel")}
          hideLabel
          maxLength={PASSKEY_NAME_MAX_LENGTH}
          autoComplete="off"
          autoFocus
          value={name}
          error={error ?? undefined}
          invalid={!!error}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
        />
        {failure && <Failure>{failure}</Failure>}
      </form>
      <span className="account-row-actions">
        <Button variant="ghost" disabled={rename.isPending} onClick={onDone}>
          {t("cancel")}
        </Button>
        <Button type="submit" form={formId} loading={rename.isPending}>
          {t("save")}
        </Button>
      </span>
    </li>
  );
}
