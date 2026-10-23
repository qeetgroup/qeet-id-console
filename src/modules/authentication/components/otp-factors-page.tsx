import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FieldGroup,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@qeetrix/ui";
import { DataState } from "@/platform/components/data-state";
import { MailIcon, MessageSquareIcon, PlusIcon, SendIcon, TrashIcon } from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import {
  type OtpChannel,
  useChallengeOtpFactor,
  useConfirmOtpFactor,
  useDeleteOtpFactor,
  useEnrollOtpStart,
  useOtpFactors,
} from "../api/mfa";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import { type ReactNode, useMemo } from "react";
import { z } from "zod";

/** Renders the signed-in person's email and SMS factors, with test send, remove and add. */
export function OtpFactorsPage() {
  const { t } = useTranslation("auth");
  const runSensitive = useSensitiveAction();
  const listQ = useOtpFactors();
  const challengeM = useChallengeOtpFactor();
  const deleteM = useDeleteOtpFactor();
  const [adding, setAdding] = useState(false);

  const items = listQ.data?.items ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        description={t("mfa.smsEmail.description")}
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <PlusIcon className="mr-2 size-4" />
            {t("mfa.smsEmail.addBtn")}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("mfa.smsEmail.list.title")}</CardTitle>
          <CardDescription>{t("mfa.smsEmail.list.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataState
            isLoading={listQ.isLoading}
            isError={listQ.isError}
            error={listQ.error}
            isEmpty={items.length === 0}
            emptyIcon={MailIcon}
            emptyTitle={t("mfa.smsEmail.list.empty")}
            skeletonRows={2}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("mfa.smsEmail.columns.channel")}</TableHead>
                  <TableHead>{t("mfa.smsEmail.columns.destination")}</TableHead>
                  <TableHead>{t("mfa.smsEmail.columns.status")}</TableHead>
                  <TableHead className="text-right">{t("mfa.smsEmail.columns.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        {f.channel === "email" ? (
                          <MailIcon className="size-4 text-muted-foreground" />
                        ) : (
                          <MessageSquareIcon className="size-4 text-muted-foreground" />
                        )}
                        {f.channel === "email"
                          ? t("mfa.smsEmail.channelEmail")
                          : t("mfa.smsEmail.channelSms")}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{f.destination}</TableCell>
                    <TableCell>
                      <StatusPill kind={f.verified ? "success" : "warning"}>
                        {f.verified
                          ? t("mfa.smsEmail.statusVerified")
                          : t("mfa.smsEmail.statusPending")}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => challengeM.mutate(f.id)}
                        disabled={!f.verified || challengeM.isPending}
                        title={t("mfa.smsEmail.sendTestTitle")}
                      >
                        <SendIcon /> {t("mfa.smsEmail.sendTestBtn")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          runSensitive({
                            confirm: {
                              title: t("mfa.smsEmail.confirm.title", { channel: f.channel }),
                              confirmLabel: t("mfa.smsEmail.confirm.label"),
                              tone: "destructive",
                            },
                            actionLabel: t("mfa.smsEmail.stepUp.remove"),
                            run: () => deleteM.mutateAsync(f.id),
                          }).catch(settleSensitiveAction)
                        }
                        disabled={deleteM.isPending}
                      >
                        <TrashIcon /> {t("mfa.smsEmail.removeBtn")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataState>
        </CardContent>
      </Card>

      <AddFactorSheet open={adding} onOpenChange={setAdding} />
    </div>
  );
}

/** Renders the sheet that adds an email or SMS factor: send a code, then confirm it. */
function AddFactorSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {open && <AddFactorFlow onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function AddFactorFlow({ onDone }: { onDone: () => void }) {
  const [sent, setSent] = useState<{ factorId: string; destination: string } | null>(null);
  return sent ? (
    <ConfirmFactorForm factorId={sent.factorId} destination={sent.destination} onDone={onDone} />
  ) : (
    <StartFactorForm onSent={setSent} />
  );
}

// The sheet's frame around one step's fields; the footer holds the step's submit.
function SheetForm({
  description,
  onSubmit,
  children,
  submit,
}: {
  description: string;
  onSubmit: () => void;
  children: ReactNode;
  submit: ReactNode;
}) {
  const { t } = useTranslation("auth");
  return (
    <form
      className="flex h-full flex-col"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <SheetHeader>
        <SheetTitle>{t("mfa.smsEmail.sheet.title")}</SheetTitle>
        <SheetDescription>{description}</SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup>{children}</FieldGroup>
      </div>
      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <SheetClose render={<Button type="button" variant="outline" />}>
          {t("mfa.smsEmail.sheet.cancelBtn")}
        </SheetClose>
        {submit}
      </SheetFooter>
    </form>
  );
}

function StartFactorForm({
  onSent,
}: {
  onSent: (sent: { factorId: string; destination: string }) => void;
}) {
  const { t } = useTranslation("auth");
  const runSensitive = useSensitiveAction();
  const enrollM = useEnrollOtpStart();
  const schema = useMemo(
    () =>
      z
        .object({
          channel: z.enum(["email", "sms"]),
          destination: z.string().trim().min(1, t("mfa.smsEmail.sheet.validation.destination")),
        })
        .refine((v) => v.channel !== "email" || z.email().safeParse(v.destination.trim()).success, {
          path: ["destination"],
          message: t("mfa.smsEmail.sheet.validation.email"),
        }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { channel: "email" as OtpChannel, destination: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      const destination = value.destination.trim();
      await runSensitive({
        actionLabel: t("mfa.smsEmail.stepUp.enroll"),
        run: () => enrollM.mutateAsync({ channel: value.channel, destination }),
      })
        .then((started) => started && onSent({ factorId: started.factor_id, destination }))
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
        });
    },
  });

  return (
    <SheetForm
      description={t("mfa.smsEmail.sheet.describeStart")}
      onSubmit={() => void form.handleSubmit()}
      submit={
        <form.AppForm>
          <form.SubmitButton pendingLabel={t("mfa.smsEmail.sheet.sendingBtn")}>
            {t("mfa.smsEmail.sheet.sendCodeBtn")}
          </form.SubmitButton>
        </form.AppForm>
      }
    >
      <form.AppField name="channel">
        {(field) => (
          <field.SelectField
            label={t("mfa.smsEmail.sheet.channelLabel")}
            options={[
              { value: "email", label: t("mfa.smsEmail.sheet.channelEmailOption") },
              { value: "sms", label: t("mfa.smsEmail.sheet.channelSmsOption") },
            ]}
          />
        )}
      </form.AppField>
      <form.Subscribe selector={(state) => state.values.channel}>
        {(channel) => (
          <form.AppField name="destination">
            {(field) =>
              channel === "email" ? (
                <field.TextField
                  label={t("mfa.smsEmail.sheet.destinationEmailLabel")}
                  description={t("mfa.smsEmail.sheet.destinationEmailHelp")}
                  placeholder={t("mfa.smsEmail.sheet.destinationEmailPlaceholder")}
                  type="email"
                  required
                />
              ) : (
                <field.TextField
                  label={t("mfa.smsEmail.sheet.destinationPhoneLabel")}
                  description={t("mfa.smsEmail.sheet.destinationPhoneHelp")}
                  placeholder={t("mfa.smsEmail.sheet.destinationPhonePlaceholder")}
                  type="tel"
                  required
                />
              )
            }
          </form.AppField>
        )}
      </form.Subscribe>
      <FormError error={enrollM.error} />
    </SheetForm>
  );
}

function ConfirmFactorForm({
  factorId,
  destination,
  onDone,
}: {
  factorId: string;
  destination: string;
  onDone: () => void;
}) {
  const { t } = useTranslation("auth");
  const confirmM = useConfirmOtpFactor();
  const schema = useMemo(
    () => z.object({ code: z.string().trim().min(1, t("mfa.smsEmail.sheet.validation.code")) }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { code: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      await confirmM
        .mutateAsync({ id: factorId, code: value.code.trim() })
        .then(onDone)
        .catch((err: unknown) => applyServerErrors(formApi, err));
    },
  });

  return (
    <SheetForm
      description={t("mfa.smsEmail.sheet.describeConfirm")}
      onSubmit={() => void form.handleSubmit()}
      submit={
        <form.AppForm>
          <form.SubmitButton pendingLabel={t("mfa.smsEmail.sheet.confirmingBtn")}>
            {t("mfa.smsEmail.sheet.confirmBtn")}
          </form.SubmitButton>
        </form.AppForm>
      }
    >
      <form.AppField name="code">
        {(field) => (
          <field.TextField
            label={t("mfa.smsEmail.sheet.codeLabel")}
            description={t("mfa.smsEmail.sheet.codeSentHelp", { destination })}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className="font-mono tracking-widest"
            required
          />
        )}
      </form.AppField>
      <FormError error={confirmM.error} />
    </SheetForm>
  );
}
