import { ArrowRightIcon, SendIcon } from "@qeetrix/icons";
import { Button, Field, Select, Textarea, TextField } from "@qeetrix/react";
import { Alert } from "@qeetrix/react/experimental";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { submitSalesLead } from "@/modules/billing";
import { errorMessage } from "@/platform/errors/user-message";
import { TEAM_SIZES } from "@/shared/data/team-sizes";

/**
 * Enterprise has no self-serve checkout, so its second step is an enquiry to sales, in the page
 * rather than a sheet over it. The person's name and email start filled in. Once sent, nothing has
 * been created; they can go back or start on Free meanwhile.
 */
export function SalesStep({
  defaults,
  onBack,
  onSent,
}: {
  defaults: { name: string; email: string };
  onBack: () => void;
  onSent: (email: string) => void;
}) {
  const { t, i18n } = useTranslation("onboarding");
  const [teamSize, setTeamSize] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [name, setName] = useState(defaults.name);
  const [email, setEmail] = useState(defaults.email);
  const send = useMutation({
    mutationFn: submitSalesLead,
    meta: { silent: true }, // the failure shows in the page
    onSuccess: (_, lead) => onSent(lead.email),
  });
  const emailError = checked && !email.trim() ? t("create.sales.emailRequired") : undefined;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (send.isPending) return;
    setChecked(true);
    if (!email.trim()) return;
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    send.mutate({
      name: name.trim(),
      email: email.trim(),
      company: text("company"),
      team_size: teamSize ?? "",
      message: text("message"),
      source: "onboarding",
    });
  }

  return (
    <form className="create-form" aria-busy={send.isPending} noValidate onSubmit={submit}>
      <TextField
        label={t("create.sales.name")}
        name="name"
        autoComplete="name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={send.isPending}
      />
      <TextField
        label={t("create.sales.email")}
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={emailError}
        disabled={send.isPending}
      />
      <TextField
        label={t("create.sales.company")}
        name="company"
        autoComplete="organization"
        placeholder={t("create.sales.companyPlaceholder")}
        disabled={send.isPending}
      />
      <Field label={t("create.sales.teamSize")}>
        <Select
          items={TEAM_SIZES.map((size) => ({ value: size.value, label: i18n.t(size.label) }))}
          value={teamSize}
          onValueChange={setTeamSize}
          placeholder={t("create.project.placeholder")}
          disabled={send.isPending}
        />
      </Field>
      <Field label={t("create.sales.message")} optional>
        <Textarea
          name="message"
          rows={3}
          placeholder={t("create.sales.messagePlaceholder")}
          disabled={send.isPending}
        />
      </Field>
      {send.isError && (
        <Alert tone="danger" title={t("create.sales.failedTitle")} announce="urgent">
          {errorMessage(send.error)}
        </Alert>
      )}
      <div className="create-actions">
        <Button
          variant="ghost"
          size="lg"
          className="create-back"
          onClick={onBack}
          disabled={send.isPending}
        >
          {t("create.back")}
        </Button>
        <Button type="submit" size="lg" icon={SendIcon} loading={send.isPending}>
          {t(send.isPending ? "create.sales.sending" : "create.sales.send")}
        </Button>
      </div>
    </form>
  );
}

/** After the enquiry: said once, with the address the reply goes to. */
export function SalesSent({
  email,
  leaveLabel,
  onLeave,
  onStartFree,
}: {
  email: string;
  leaveLabel: string;
  onLeave: () => void;
  onStartFree: () => void;
}) {
  const { t } = useTranslation("onboarding");
  return (
    <div className="create-form">
      <Alert tone="success" title={t("create.sales.sentAlertTitle")}>
        {t("create.sales.sentAlertBody", { email })}
      </Alert>
      <div className="create-actions">
        <Button variant="ghost" size="lg" className="create-back" onClick={onLeave}>
          {leaveLabel}
        </Button>
        <Button size="lg" icon={ArrowRightIcon} onClick={onStartFree}>
          {t("create.sales.startFree")}
        </Button>
      </div>
    </div>
  );
}
