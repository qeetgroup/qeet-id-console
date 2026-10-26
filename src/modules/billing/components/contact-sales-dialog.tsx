// Enterprise contact-sales form: submits a lead the server stores and emails to sales, so nothing
// is lost to an unopened mail client. The caller owns the open state.

import {
  Button,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@qeetrix/ui";
import { useMutation } from "@tanstack/react-query";
import { LoaderCircleIcon } from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { TEAM_SIZES } from "@/shared/data/team-sizes";

import { type SalesLead, submitSalesLead } from "../api/billing";

export function ContactSalesDialog({
  open,
  onOpenChange,
  source,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  source: string; // where the form opened, recorded on the lead, e.g. "onboarding"
}) {
  const { t, i18n } = useTranslation(["billing", "common"]);
  const [teamSize, setTeamSize] = useState("");
  const submitM = useMutation({
    mutationFn: (lead: SalesLead) => submitSalesLead(lead),
    meta: { successMessage: "billing:toast.thanksOurTeamWill" },
    onSuccess: () => onOpenChange(false),
  });

  const str = (d: FormData, k: string) => String(d.get(k) ?? "").trim();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <form
          className="flex h-full flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            submitM.mutate({
              name: str(d, "name"),
              email: str(d, "email"),
              company: str(d, "company"),
              team_size: teamSize,
              message: str(d, "message"),
              source,
            });
          }}
        >
          <SheetHeader>
            <SheetTitle>{t("contactSalesDialog.talkToSales")}</SheetTitle>
            <SheetDescription>{t("contactSalesDialog.tellUsAboutYour")}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="cs-name">{t("contactSalesDialog.yourName")}</FieldLabel>
                <Input id="cs-name" name="name" placeholder={t("contactSalesDialog.janeDoe")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="cs-email">{t("contactSalesDialog.workEmail")}</FieldLabel>
                <Input
                  id="cs-email"
                  name="email"
                  type="email"
                  required
                  placeholder="jane@acme.com"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="cs-company">{t("contactSalesDialog.company")}</FieldLabel>
                <Input
                  id="cs-company"
                  name="company"
                  placeholder={t("contactSalesDialog.acmeCorp")}
                />
              </Field>
              <Field>
                <FieldLabel>{t("contactSalesDialog.teamSize")}</FieldLabel>
                <Select value={teamSize || undefined} onValueChange={(v) => setTeamSize(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("contactSalesDialog.select")} />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_SIZES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {i18n.t(o.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="cs-message">
                  {t("contactSalesDialog.whatAreYouLookingFor")}
                </FieldLabel>
                <Textarea
                  id="cs-message"
                  name="message"
                  rows={4}
                  placeholder={t("contactSalesDialog.aFewWordsOn")}
                />
              </Field>
            </FieldGroup>
          </div>
          <SheetFooter className="flex-row justify-end gap-2 border-t">
            <SheetClose render={<Button type="button" variant="outline" />}>
              {t("common:actions.cancel")}
            </SheetClose>
            <Button type="submit" disabled={submitM.isPending}>
              {submitM.isPending && <LoaderCircleIcon className="animate-spin" />}
              {submitM.isPending ? t("contactSalesDialog.sending") : t("contactSalesDialog.send")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
