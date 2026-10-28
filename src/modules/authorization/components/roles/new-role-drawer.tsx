import {
  Button,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  Field,
  Text,
  Textarea,
  TextField,
} from "@qeetrix/react";
import { Alert } from "@qeetrix/react/experimental";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ErrorReference } from "@/platform/components/error-reference";
import { ERROR_CODES } from "@/platform/errors/error-codes";
import { normalizeError } from "@/platform/errors/normalize-error";
import { errorMessage } from "@/platform/errors/user-message";
import { type Role, useCreateRole } from "@/modules/authorization/api/rbac";

// The server's limits (rbac createRoleInput).
const NAME_MAX = 64;
const DESCRIPTION_MAX = 500;
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * New role: a name and a line about it. It's made empty (the create call takes no permissions), so
 * the page opens the new role's drawer next to choose them. Names are unique in an organisation,
 * ignoring case; making a role needs no step-up, giving it permissions does.
 */
export function NewRoleDrawer({
  open,
  onOpenChange,
  roles,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: readonly Role[];
  onCreated: (role: Role) => void;
}) {
  const { t } = useTranslation(["authorization", "common"]);
  const createM = useCreateRole();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState<string>();
  const [failure, setFailure] = useState<unknown>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setNameError(undefined);
    setFailure(null);
  }, [open]);

  const clash = name.trim() ? roles.find((r) => same(r.name, name)) : undefined;
  const shownError =
    nameError ?? (clash ? t("lists.newRole.nameTaken", { name: clash.name }) : undefined);

  async function submit() {
    if (!name.trim()) return setNameError(t("lists.newRole.nameRequired"));
    if (clash) return;
    setFailure(null);
    try {
      const made = await createM.mutateAsync({
        name: name.trim(),
        description: description.trim(),
      });
      onOpenChange(false);
      onCreated(made);
    } catch (err) {
      if (normalizeError(err).code === ERROR_CODES.RBAC_ROLE_NAME_EXISTS)
        setNameError(t("lists.newRole.nameTaken", { name: name.trim() }));
      else setFailure(err);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        title={t("lists.newRole.title")}
        description={t("lists.newRole.description")}
        size="sm"
      >
        <form
          id="authz-new-role"
          className="authz-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <DrawerBody>
            <div className="authz-form">
              <TextField
                label={t("lists.newRole.name")}
                placeholder={t("lists.newRole.namePlaceholder")}
                value={name}
                onValueChange={(v) => {
                  setName(v);
                  setNameError(undefined);
                }}
                maxLength={NAME_MAX}
                required
                error={shownError}
                autoComplete="off"
              />
              <Field label={t("lists.newRole.descriptionLabel")} optional>
                <Textarea
                  placeholder={t("lists.newRole.descriptionPlaceholder")}
                  value={description}
                  onValueChange={setDescription}
                  maxLength={DESCRIPTION_MAX}
                  rows={2}
                  maxRows={5}
                />
              </Field>
              <Text size="sm" tone="subtle" render={<p className="authz-drawer-note" />}>
                {t("lists.newRole.note")}
              </Text>
              {failure ? (
                <Alert tone="danger" title={errorMessage(failure)}>
                  <ErrorReference error={failure} />
                </Alert>
              ) : null}
            </div>
          </DrawerBody>
        </form>
        <DrawerFooter>
          <DrawerClose render={<Button variant="ghost">{t("common:actions.cancel")}</Button>} />
          <Button type="submit" form="authz-new-role" disabled={createM.isPending}>
            {t("lists.newRole.create")}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
