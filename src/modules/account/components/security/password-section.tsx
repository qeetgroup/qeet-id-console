import { KeyRoundIcon } from "@qeetrix/icons";
import { Badge, Button, Field } from "@qeetrix/react";
import { PasswordInput } from "@qeetrix/react/experimental";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useChangePassword, useForgotPassword, usePasswordStatus } from "@/modules/authentication";
import { useMe } from "@/platform/auth/session";
import { toastError } from "@/platform/errors/error-toast";
import { errorMessage } from "@/platform/errors/user-message";
import { Failure, Item, Panel, Section } from "../account-parts";

const MIN_LENGTH = 8;

/**
 * The password: change it, or set a first one on an account that signs in with a provider or a
 * passkey. A forgotten one is reset by email, since the signed-out reset page isn't reachable
 * from here.
 */
export function PasswordSection() {
  const { t } = useTranslation("account");
  const status = usePasswordStatus();
  const hasPassword = status.data?.has_password ?? true;
  const [editing, setEditing] = useState(false);

  return (
    <Section title={t("security.password.title")} description={t("security.password.description")}>
      <ul className="account-rows">
        {editing ? (
          // Remounted when a first password is set, so the form gains its current-password field.
          <PasswordForm
            key={String(hasPassword)}
            hasPassword={hasPassword}
            onDone={() => setEditing(false)}
          />
        ) : (
          <Item
            icon={<KeyRoundIcon />}
            name={t("security.password.name")}
            badge={
              status.isSuccess && (
                <Badge tone={hasPassword ? "neutral" : "warning"} size="sm">
                  {hasPassword ? t("security.password.set") : t("security.password.notSet")}
                </Badge>
              )
            }
            line={hasPassword ? t("security.password.line") : t("security.password.lineNone")}
            actions={
              <Button variant="ghost" onClick={() => setEditing(true)}>
                {hasPassword ? t("security.password.change") : t("security.password.add")}
              </Button>
            }
          />
        )}
      </ul>
    </Section>
  );
}

function PasswordForm({ hasPassword, onDone }: { hasPassword: boolean; onDone: () => void }) {
  const { t } = useTranslation("account");
  const change = useChangePassword();
  const forgot = useForgotPassword();
  const email = useMe().data?.email;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string; form?: string }>({});

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = {
      current: hasPassword && !current ? t("security.password.currentRequired") : undefined,
      next:
        next.length < MIN_LENGTH
          ? t("security.password.tooShort", { count: MIN_LENGTH })
          : undefined,
    };
    setErrors(found);
    if (found.current || found.next) return;
    change.mutate(
      { current_password: hasPassword ? current : "", new_password: next },
      {
        onSuccess: () => {
          toast.success(
            hasPassword ? t("security.password.changed") : t("security.password.added"),
          );
          onDone();
        },
        onError: (err) => setErrors({ form: errorMessage(err) }),
      },
    );
  }

  const emailResetLink = () =>
    email &&
    forgot.mutate(
      { email },
      {
        onSuccess: () => toast.success(t("security.password.resetSent", { email })),
        onError: (err) => toastError(err),
      },
    );

  return (
    <Panel
      as="li"
      title={hasPassword ? t("security.password.changeTitle") : t("security.password.addTitle")}
      description={hasPassword ? undefined : t("security.password.addDescription")}
    >
      <form className="account-panel-form" noValidate onSubmit={submit}>
        {hasPassword && (
          <Field
            label={t("security.password.current")}
            error={errors.current}
            invalid={!!errors.current}
          >
            <PasswordInput
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          </Field>
        )}
        <Field
          label={t("security.password.new")}
          description={t("security.password.newHint", { count: MIN_LENGTH })}
          error={errors.next}
          invalid={!!errors.next}
        >
          <PasswordInput
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
          />
        </Field>
        {errors.form && <Failure>{errors.form}</Failure>}
        {hasPassword && (
          <span className="account-panel-links">
            <Button
              variant="ghost"
              size="sm"
              loading={forgot.isPending}
              disabled={!email}
              onClick={emailResetLink}
            >
              {t("security.password.forgot")}
            </Button>
          </span>
        )}
        <span className="account-panel-actions">
          <Button size="lg" type="submit" loading={change.isPending}>
            {hasPassword ? t("security.password.submitChange") : t("security.password.submitAdd")}
          </Button>
          <Button variant="ghost" size="lg" onClick={onDone}>
            {t("cancel")}
          </Button>
        </span>
      </form>
    </Panel>
  );
}
