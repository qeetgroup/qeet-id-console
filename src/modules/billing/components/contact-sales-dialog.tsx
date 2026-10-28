// Enterprise contact-sales form: submits a lead the server stores and, best effort, emails to the
// sales inbox, so nothing is lost to an unopened mail client. The caller owns the open state.

import { SendIcon } from "@qeetrix/icons";
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  Field,
  Select,
  Textarea,
  TextField,
} from "@qeetrix/react";
import { Alert } from "@qeetrix/react/experimental";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { useMe } from "@/platform/auth/session";
import { errorMessage } from "@/platform/errors/user-message";
import { TEAM_SIZES } from "@/shared/data/team-sizes";

import { type SalesLead, submitSalesLead } from "../api/billing";

/** Talk to sales, in a drawer: the person's name and email start filled in; only the email is needed. */
export function ContactSalesDialog({
  open,
  onOpenChange,
  source,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  source: string; // where the form opened, recorded on the lead, e.g. "onboarding"
}) {
  const { t } = useTranslation("billing");
  const send = useMutation({
    mutationFn: (lead: SalesLead) => submitSalesLead(lead),
    meta: { successMessage: "billing:toast.thanksOurTeamWill", silentError: true },
    onSuccess: () => onOpenChange(false),
  });
  return (
    <Drawer open={open} onOpenChange={(next) => (!send.isPending || next) && onOpenChange(next)}>
      <DrawerContent
        title={t("contactSalesDialog.talkToSales")}
        description={t("contactSalesDialog.tellUsAboutYour")}
        size="md"
      >
        {/* Mounted while open, so each opening starts from the person's own details. */}
        {open && (
          <SalesForm
            pending={send.isPending}
            failure={send.isError ? send.error : null}
            onSend={(lead) => send.mutate({ ...lead, source })}
          />
        )}
        <DrawerFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={send.isPending}>
            {t("contactSalesDialog.cancel")}
          </Button>
          <Button type="submit" form="contact-sales" icon={SendIcon} loading={send.isPending}>
            {t(send.isPending ? "contactSalesDialog.sending" : "contactSalesDialog.send")}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function SalesForm({
  pending,
  failure,
  onSend,
}: {
  pending: boolean;
  failure: unknown;
  onSend: (lead: Omit<SalesLead, "source">) => void;
}) {
  const { t, i18n } = useTranslation("billing");
  const me = useMe().data;
  const [name, setName] = useState(me?.display_name?.trim() ?? "");
  const [email, setEmail] = useState(me?.email ?? "");
  const [teamSize, setTeamSize] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setChecked(true);
    if (!email.trim()) return;
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    onSend({
      name: name.trim(),
      email: email.trim(),
      company: text("company"),
      team_size: teamSize ?? "",
      message: text("message"),
    });
  }

  return (
    <DrawerBody>
      <form id="contact-sales" className="sub-form" noValidate onSubmit={submit}>
        {failure ? (
          <Alert tone="danger" title={t("contactSalesDialog.failed")} announce="urgent">
            {errorMessage(failure)}
          </Alert>
        ) : null}
        <TextField
          label={t("contactSalesDialog.yourName")}
          autoComplete="name"
          value={name}
          onValueChange={setName}
          disabled={pending}
        />
        <TextField
          label={t("contactSalesDialog.workEmail")}
          type="email"
          autoComplete="email"
          value={email}
          onValueChange={setEmail}
          error={checked && !email.trim() ? t("contactSalesDialog.emailRequired") : undefined}
          disabled={pending}
        />
        <TextField
          label={t("contactSalesDialog.company")}
          name="company"
          autoComplete="organization"
          disabled={pending}
        />
        <Field label={t("contactSalesDialog.teamSize")} optional>
          <Select
            items={TEAM_SIZES.map((size) => ({ value: size.value, label: i18n.t(size.label) }))}
            value={teamSize}
            onValueChange={setTeamSize}
            placeholder={t("contactSalesDialog.select")}
            disabled={pending}
          />
        </Field>
        <Field label={t("contactSalesDialog.whatAreYouLookingFor")} optional>
          <Textarea
            name="message"
            rows={4}
            placeholder={t("contactSalesDialog.aFewWordsOn")}
            disabled={pending}
          />
        </Field>
      </form>
    </DrawerBody>
  );
}
