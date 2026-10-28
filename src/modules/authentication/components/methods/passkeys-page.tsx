import { FingerprintPatternIcon, PlusIcon } from "@qeetrix/icons";
import { Button, VisuallyHidden } from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import {
  canAddPasskey,
  type Passkey,
  PASSKEY_NAME_MAX_LENGTH,
  passkeyDisplayName,
  usePasskeys,
  useRegisterPasskey,
  useRemovePasskey,
  useRenamePasskey,
} from "@/modules/authentication/api/passkeys";
import { isLastSignInMethod, useSignInMethods } from "@/modules/authentication/api/sign-in-methods";
import { applyServerErrors, useAppForm } from "@/platform/forms/app-form";
import { errorMessage } from "@/platform/errors/user-message";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { isStepUpRequired } from "@/platform/security/step-up";
import { Failure, Item, LoadFailed, Loading, Panel, Section, when } from "./methods-parts";
import { MethodsArea } from "./sign-in-area";

/**
 * Authentication › Sign-in › Passkeys: the signed-in person's own passkeys (the same list as My
 * account › Security, kept here for now): add one when the organisation allows it, rename it where
 * it's listed, or remove it unless it's the last way to sign in.
 */
export function PasskeysPage() {
  const { t } = useTranslation("authentication");
  return (
    <MethodsArea title={t("methods.signIn.title")} description={t("methods.signIn.description")}>
      <OwnPasskeys />
    </MethodsArea>
  );
}

function OwnPasskeys() {
  const { t } = useTranslation("authentication");
  const runSensitive = useSensitiveAction();
  const passkeys = usePasskeys();
  const remove = useRemovePasskey();
  // The server refuses removing the last way to sign in; say so before the button is pressed.
  const lastMethod = isLastSignInMethod(useSignInMethods().data);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const items = passkeys.data?.items ?? [];
  const canAdd = canAddPasskey(passkeys.data);
  const unnamed = t("ownPasskeys.unnamed");

  const removeOne = (passkey: Passkey) =>
    runSensitive({
      confirm: {
        title: t("ownPasskeys.removeTitle", { name: passkeyDisplayName(passkey, unnamed) }),
        description: t("ownPasskeys.removeDescription"),
        confirmLabel: t("methods.remove"),
        tone: "destructive",
      },
      actionLabel: t("ownPasskeys.removeAction"),
      run: () => remove.mutateAsync(passkey.id),
    }).catch(settleSensitiveAction);

  return (
    <Section
      title={t("ownPasskeys.title")}
      description={
        <>
          {t("ownPasskeys.descriptionBefore")}{" "}
          <Link to="/account/security">{t("ownPasskeys.descriptionLink")}</Link>
          {t("ownPasskeys.descriptionAfter")}
        </>
      }
      action={
        canAdd &&
        !adding && (
          <Button variant="soft" icon={PlusIcon} onClick={() => setAdding(true)}>
            {t("ownPasskeys.add")}
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
                        ? t("ownPasskeys.lineUsed", {
                            added: when(passkey.created_at),
                            used: when(passkey.last_used_at),
                          })
                        : t("ownPasskeys.line", { added: when(passkey.created_at) })
                    }
                    actions={
                      <>
                        <Button
                          variant="ghost"
                          aria-label={t("ownPasskeys.renameNamed", { name })}
                          onClick={() => setRenaming(passkey.id)}
                        >
                          {t("ownPasskeys.rename")}
                        </Button>
                        <Button
                          variant="ghost"
                          aria-label={t("methods.removeNamed", { name })}
                          disabled={
                            lastMethod || (remove.isPending && remove.variables === passkey.id)
                          }
                          title={lastMethod ? t("ownPasskeys.lastMethod") : undefined}
                          onClick={() => void removeOne(passkey)}
                        >
                          {t("methods.remove")}
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
              {canAdd ? t("ownPasskeys.empty") : t("ownPasskeys.disabled")}
            </p>
          )}
          {items.length > 0 && !canAdd && (
            <p className="account-note">{t("ownPasskeys.disabled")}</p>
          )}
          {items.length > 0 && lastMethod && (
            <p className="account-note">{t("ownPasskeys.lastMethod")}</p>
          )}
        </>
      )}
    </Section>
  );
}

/** Adding one: an optional name, then the browser's own prompt. A dismissed prompt isn't an error. */
function AddPasskey({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("authentication");
  const runSensitive = useSensitiveAction();
  const register = useRegisterPasskey();
  const [failure, setFailure] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: { name: "" },
    onSubmit: async ({ value }) => {
      setFailure(null);
      await runSensitive({
        actionLabel: t("ownPasskeys.add"),
        run: () =>
          register.mutateAsync(
            { name: value.name },
            {
              onError: (err) =>
                setFailure(
                  isStepUpRequired(err)
                    ? null
                    : err instanceof Error && err.name === "NotAllowedError"
                      ? t("ownPasskeys.cancelled")
                      : errorMessage(err),
                ),
            },
          ),
      })
        .then(() => {
          toast.success(t("ownPasskeys.added"));
          onClose();
        })
        .catch(settleSensitiveAction);
    },
  });

  return (
    <Panel as="li" title={t("ownPasskeys.addTitle")} description={t("ownPasskeys.addDescription")}>
      <form
        className="account-panel-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.AppField name="name">
          {(field) => (
            <field.TextField
              label={t("ownPasskeys.nameLabel")}
              description={t("ownPasskeys.nameHint")}
              placeholder={t("ownPasskeys.namePlaceholder")}
              maxLength={PASSKEY_NAME_MAX_LENGTH}
              autoComplete="off"
            />
          )}
        </form.AppField>
        {failure && (
          <p role="alert" className="account-failure">
            {failure}
          </p>
        )}
        <span className="account-panel-actions">
          <Button size="lg" type="submit" loading={register.isPending}>
            {register.isPending ? t("ownPasskeys.adding") : t("ownPasskeys.create")}
          </Button>
          <Button variant="ghost" size="lg" onClick={onClose}>
            {t("methods.cancel")}
          </Button>
        </span>
      </form>
    </Panel>
  );
}

/** Renaming one where it's listed: its name becomes a field, its actions Cancel and Save. */
function RenamePasskey({ passkey, onDone }: { passkey: Passkey; onDone: () => void }) {
  const { t } = useTranslation("authentication");
  const rename = useRenamePasskey();
  const formId = useId();
  const required = t("ownPasskeys.nameRequired");
  const form = useAppForm({
    defaultValues: { name: passkey.name ?? "" },
    validators: {
      onSubmit: z.object({
        name: z.string().trim().min(1, required).max(PASSKEY_NAME_MAX_LENGTH),
      }),
    },
    onSubmit: async ({ value, formApi }) => {
      const next = value.name.trim();
      if (next === passkey.name?.trim()) return onDone();
      await rename
        .mutateAsync({ id: passkey.id, name: next })
        .then(onDone)
        .catch((err: unknown) => applyServerErrors(formApi, err));
    },
  });

  return (
    <li className="account-row" data-editing="">
      <span className="account-icon" aria-hidden="true">
        <FingerprintPatternIcon />
      </span>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.AppField name="name">
          {(field) => (
            <field.TextField
              label={<VisuallyHidden>{t("ownPasskeys.nameLabel")}</VisuallyHidden>}
              maxLength={PASSKEY_NAME_MAX_LENGTH}
              autoComplete="off"
              autoFocus
            />
          )}
        </form.AppField>
        <Failure error={rename.error} />
      </form>
      <span className="account-row-actions">
        <Button variant="ghost" disabled={rename.isPending} onClick={onDone}>
          {t("methods.cancel")}
        </Button>
        <Button type="submit" form={formId} loading={rename.isPending}>
          {t("methods.save")}
        </Button>
      </span>
    </li>
  );
}
