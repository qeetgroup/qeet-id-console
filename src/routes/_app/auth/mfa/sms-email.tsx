import { Add, MessageSquare, RefreshArrow, Send, Sms, Trash } from "@qeetrix/icons";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataState,
  Field,
  FieldDescription,
  FieldError,
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
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@qeetrix/ui";
import { createFileRoute } from "@tanstack/react-router";
import { errorMessage } from "@/platform/errors/user-message";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useConfirmDialog } from "@/shared/components/confirm-dialog";
import { PageHeader } from "@/platform/components/page-header";
import {
  type OtpChannel,
  useChallengeOtpFactor,
  useConfirmOtpFactor,
  useDeleteOtpFactor,
  useEnrollOtpStart,
  useOtpFactors,
} from "@/modules/authentication/api/mfa";

export const Route = createFileRoute("/_app/auth/mfa/sms-email")({
  component: SmsEmailPage,
});

function SmsEmailPage() {
  const { t } = useTranslation("auth");
  const [confirmDialog, openConfirm] = useConfirmDialog();
  const listQ = useOtpFactors();
  const challengeM = useChallengeOtpFactor();
  const deleteM = useDeleteOtpFactor();
  const [adding, setAdding] = useState(false);

  const items = listQ.data?.items ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {confirmDialog}
      <PageHeader
        description={t("mfa.smsEmail.description")}
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Add className="mr-2 size-4" />
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
            emptyIcon={Sms}
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
                          <Sms className="size-4 text-muted-foreground" />
                        ) : (
                          <MessageSquare className="size-4 text-muted-foreground" />
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
                        <Send /> {t("mfa.smsEmail.sendTestBtn")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          openConfirm({
                            title: t("mfa.smsEmail.confirm.title", {
                              channel: f.channel,
                            }),
                            variant: "destructive",
                            confirmLabel: t("mfa.smsEmail.confirm.label"),
                            onConfirm: () => deleteM.mutate(f.id),
                          })
                        }
                        disabled={deleteM.isPending}
                      >
                        <Trash /> {t("mfa.smsEmail.removeBtn")}
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

function AddFactorSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation("auth");
  const enrollM = useEnrollOtpStart();
  const confirmM = useConfirmOtpFactor();
  const [channel, setChannel] = useState<OtpChannel>("email");
  const [destination, setDestination] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const reset = () => {
    setChannel("email");
    setDestination("");
    setFactorId(null);
    setCode("");
    enrollM.reset();
    confirmM.reset();
  };

  const close = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <div className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>{t("mfa.smsEmail.sheet.title")}</SheetTitle>
            <SheetDescription>
              {factorId
                ? t("mfa.smsEmail.sheet.describeConfirm")
                : t("mfa.smsEmail.sheet.describeStart")}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4">
            {!factorId ? (
              <form
                id="otp-start"
                onSubmit={(e) => {
                  e.preventDefault();
                  enrollM.mutate(
                    { channel, destination: destination.trim() },
                    { onSuccess: (d) => setFactorId(d.factor_id) },
                  );
                }}
              >
                <FieldGroup>
                  <Field>
                    <FieldLabel>{t("mfa.smsEmail.sheet.channelLabel")}</FieldLabel>
                    <Select value={channel} onValueChange={(v) => setChannel(v as OtpChannel)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">
                          {t("mfa.smsEmail.sheet.channelEmailOption")}
                        </SelectItem>
                        <SelectItem value="sms">
                          {t("mfa.smsEmail.sheet.channelSmsOption")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="otp-destination">
                      {channel === "email"
                        ? t("mfa.smsEmail.sheet.destinationEmailLabel")
                        : t("mfa.smsEmail.sheet.destinationPhoneLabel")}
                    </FieldLabel>
                    <Input
                      id="otp-destination"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder={
                        channel === "email"
                          ? t("mfa.smsEmail.sheet.destinationEmailPlaceholder")
                          : t("mfa.smsEmail.sheet.destinationPhonePlaceholder")
                      }
                      required
                    />
                    <FieldDescription>
                      {channel === "sms"
                        ? t("mfa.smsEmail.sheet.destinationPhoneHelp")
                        : t("mfa.smsEmail.sheet.destinationEmailHelp")}
                    </FieldDescription>
                  </Field>
                  {enrollM.error && (
                    <Field>
                      <FieldError>{errorMessage(enrollM.error)}</FieldError>
                    </Field>
                  )}
                </FieldGroup>
              </form>
            ) : (
              <form
                id="otp-confirm"
                onSubmit={(e) => {
                  e.preventDefault();
                  confirmM.mutate(
                    { id: factorId, code: code.trim() },
                    { onSuccess: () => close(false) },
                  );
                }}
              >
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="otp-code">{t("mfa.smsEmail.sheet.codeLabel")}</FieldLabel>
                    <Input
                      id="otp-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      className="font-mono tracking-widest"
                      required
                    />
                    <FieldDescription>
                      {t("mfa.smsEmail.sheet.codeSentHelp", { destination })}
                    </FieldDescription>
                  </Field>
                  {confirmM.error && (
                    <Field>
                      <FieldError>{errorMessage(confirmM.error)}</FieldError>
                    </Field>
                  )}
                </FieldGroup>
              </form>
            )}
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t">
            <SheetClose render={<Button type="button" variant="outline" />}>
              {t("mfa.smsEmail.sheet.cancelBtn")}
            </SheetClose>
            {!factorId ? (
              <Button
                type="submit"
                form="otp-start"
                disabled={enrollM.isPending || !destination.trim()}
              >
                {enrollM.isPending && <RefreshArrow className="animate-spin" />}
                {enrollM.isPending
                  ? t("mfa.smsEmail.sheet.sendingBtn")
                  : t("mfa.smsEmail.sheet.sendCodeBtn")}
              </Button>
            ) : (
              <Button
                type="submit"
                form="otp-confirm"
                disabled={confirmM.isPending || !code.trim()}
              >
                {confirmM.isPending && <RefreshArrow className="animate-spin" />}
                {confirmM.isPending
                  ? t("mfa.smsEmail.sheet.confirmingBtn")
                  : t("mfa.smsEmail.sheet.confirmBtn")}
              </Button>
            )}
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
