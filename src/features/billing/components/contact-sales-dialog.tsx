// In-app "Contact sales" form (Enterprise). Replaces the old mailto: link —
// submits a lead to the backend (persisted + emailed to sales) so nothing is
// lost to an unopened mail client. Used from the onboarding plan picker and the
// billing page; each caller owns the open/close state.

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
import { Loader2Icon } from "lucide-react";
import { useState } from "react";

import { TEAM_SIZES } from "@/features/onboarding/onboarding-profile";
import { api } from "@/lib/api";

type LeadBody = {
  name: string;
  email: string;
  company: string;
  team_size: string;
  message: string;
  source: string;
};

export function ContactSalesDialog({
  open,
  onOpenChange,
  source,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Where the form was opened from, recorded on the lead (e.g. "onboarding"). */
  source: string;
}) {
  const [teamSize, setTeamSize] = useState("");
  const submitM = useMutation({
    mutationFn: (body: LeadBody) =>
      api<{ status: string }>("/v1/sales/leads", { method: "POST", body }),
    meta: { successMessage: "Thanks — our team will be in touch shortly." },
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
            <SheetTitle>Talk to sales</SheetTitle>
            <SheetDescription>
              Tell us about your needs and we'll reach out about Enterprise — SSO enforcement, SCIM,
              data residency, SLAs and more.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="cs-name">Your name</FieldLabel>
                <Input id="cs-name" name="name" placeholder="Jane Doe" />
              </Field>
              <Field>
                <FieldLabel htmlFor="cs-email">Work email</FieldLabel>
                <Input
                  id="cs-email"
                  name="email"
                  type="email"
                  required
                  placeholder="jane@acme.com"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="cs-company">Company</FieldLabel>
                <Input id="cs-company" name="company" placeholder="Acme Corp" />
              </Field>
              <Field>
                <FieldLabel>Team size</FieldLabel>
                <Select value={teamSize || undefined} onValueChange={(v) => setTeamSize(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_SIZES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="cs-message">What are you looking for?</FieldLabel>
                <Textarea
                  id="cs-message"
                  name="message"
                  rows={4}
                  placeholder="A few words on your use case, timeline, and requirements."
                />
              </Field>
            </FieldGroup>
          </div>
          <SheetFooter className="flex-row justify-end gap-2 border-t">
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
            <Button type="submit" disabled={submitM.isPending}>
              {submitM.isPending && <Loader2Icon className="animate-spin" />}
              {submitM.isPending ? "Sending…" : "Send"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
