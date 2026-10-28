import { ArrowRightIcon, FileCheckIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  Field,
  formatDate,
  Radio,
  RadioGroup,
  Textarea,
  TextField,
} from "@qeetrix/react";
import { DescriptionItem, DescriptionList } from "@qeetrix/react/experimental";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { applyServerErrors, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import {
  useIssueCredential,
  useVerifyCredential,
  type VerifyResult,
} from "@/modules/developer/api/credentials";
import { DAY } from "@/modules/developer/machine-model";
import { fieldError, FormFailure } from "../form-parts";
import { ShownOnceDrawer, useNumbers } from "../parts";

const VALID_FOR = ["365", "90", "0"] as const;
type ValidFor = (typeof VALID_FOR)[number];
const REASONS = ["vc.not_credential", "vc.signature_invalid", "vc.unknown", "vc.revoked"] as const;
const reasonKey = (code?: string) => {
  const known = REASONS.find((r) => r === code);
  return known
    ? (known.slice(3) as "not_credential" | "signature_invalid" | "unknown" | "revoked")
    : "other";
};

const isObject = (raw: string) => {
  if (!raw.trim()) return true;
  try {
    const v: unknown = JSON.parse(raw);
    return !!v && typeof v === "object" && !Array.isArray(v);
  } catch {
    return false;
  }
};

/**
 * Issue a credential: who it's about, its type, what it states (a JSON object) and how long it's
 * valid. It's signed with the active signing key and shown once: the server records that it was
 * issued, not the credential.
 */
export function IssueDrawer({
  open,
  onOpenChange,
  types,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  types: readonly string[];
}) {
  const { t } = useTranslation("developer");
  const { locale } = useNumbers();
  const runSensitive = useSensitiveAction();
  const issueM = useIssueCredential();
  const [made, setMade] = useState<{
    type: string;
    subject: string;
    jwt: string;
    expires?: string;
  } | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const schema = useMemo(
    () =>
      z.object({
        subject: z.string().trim().min(1, t("issue.subjectRequired")),
        type: z.string().trim().min(1, t("issue.typeRequired")),
        claims: z.string().refine(isObject, t("issue.claimsInvalid")),
        validFor: z.enum(VALID_FOR),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { subject: "", type: types[0] ?? "", claims: "", validFor: "365" as ValidFor },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      setFailure(null);
      await runSensitive({
        actionLabel: t("issue.stepUp"),
        run: () =>
          issueM.mutateAsync({
            subject: value.subject.trim(),
            type: value.type.trim(),
            claims: value.claims.trim()
              ? (JSON.parse(value.claims) as Record<string, unknown>)
              : {},
            ttl_seconds: Number(value.validFor) * (DAY / 1000),
          }),
      })
        .then((res) => {
          if (!res) return;
          setMade({
            type: value.type.trim(),
            subject: value.subject.trim(),
            jwt: res.jwt,
            expires: res.expires_at,
          });
          onOpenChange(false);
        })
        .catch((err: unknown) => {
          applyServerErrors(formApi, err, { ttl_seconds: "validFor" });
          setFailure(err);
          settleSensitiveAction(err);
        });
    },
  });
  useEffect(() => {
    if (!open) return;
    form.reset({ subject: "", type: types[0] ?? "", claims: "", validFor: "365" });
    setFailure(null);
  }, [open, form, types]);

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent title={t("issue.title")} description={t("issue.description")} size="md">
          <DrawerBody>
            <form
              id="issue-drawer"
              className="dev-form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void form.handleSubmit();
              }}
            >
              <FormFailure error={failure} />
              <form.Field name="subject">
                {(field) => (
                  <TextField
                    label={t("issue.subject")}
                    value={field.state.value}
                    onValueChange={field.handleChange}
                    onBlur={field.handleBlur}
                    placeholder={t("issue.subjectPlaceholder")}
                    description={t("issue.subjectHelp")}
                    autoComplete="off"
                    error={fieldError(field.state.meta.errors)}
                  />
                )}
              </form.Field>
              <form.Field name="type">
                {(field) => (
                  <TextField
                    label={t("issue.type")}
                    value={field.state.value}
                    onValueChange={field.handleChange}
                    onBlur={field.handleBlur}
                    placeholder={t("issue.typePlaceholder")}
                    description={
                      types.length
                        ? t("issue.typeUsed", { types: types.slice(0, 3).join(", ") })
                        : t("issue.typeHelp")
                    }
                    autoComplete="off"
                    error={fieldError(field.state.meta.errors)}
                  />
                )}
              </form.Field>
              <form.Field name="claims">
                {(field) => (
                  <Field
                    label={t("issue.claims")}
                    optional
                    description={
                      fieldError(field.state.meta.errors) ? undefined : t("issue.claimsHelp")
                    }
                    error={fieldError(field.state.meta.errors)}
                  >
                    <Textarea
                      className="dev-code-area"
                      rows={5}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={'{\n  "employeeId": "QEE-1041"\n}'}
                    />
                  </Field>
                )}
              </form.Field>
              <form.Field name="validFor">
                {(field) => (
                  <RadioGroup
                    label={t("issue.validFor")}
                    orientation="horizontal"
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v as ValidFor)}
                  >
                    <Radio
                      value="365"
                      label={
                        <span className="dev-choice">
                          {t("issue.year")}
                          <Badge tone="brand" size="sm">
                            {t("keyDrawer.recommended")}
                          </Badge>
                        </span>
                      }
                    />
                    <Radio value="90" label={t("issue.days90")} />
                    <Radio value="0" label={t("issue.noExpiry")} />
                  </RadioGroup>
                )}
              </form.Field>
            </form>
          </DrawerBody>
          <DrawerFooter>
            <DrawerClose render={<Button variant="ghost">{t("drawer.cancel")}</Button>} />
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(submitting) => (
                <Button
                  type="submit"
                  form="issue-drawer"
                  icon={ArrowRightIcon}
                  loading={submitting}
                >
                  {t("issue.submit")}
                </Button>
              )}
            </form.Subscribe>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <ShownOnceDrawer
        open={!!made}
        title={made ? t("issue.made", { type: made.type }) : ""}
        description={
          made
            ? made.expires
              ? t("issue.madeFor", {
                  subject: made.subject,
                  date: formatDate(made.expires, locale, { dateStyle: "long" }),
                })
              : t("issue.madeForever", { subject: made.subject })
            : undefined
        }
        warning={t("shownOnce.credential")}
        why={t("shownOnce.credentialWhy")}
        values={made ? [{ label: t("issue.jwt"), value: made.jwt }] : []}
        onDone={() => setMade(null)}
      />
    </>
  );
}

/** Verify a credential: the public check relying parties use (signature, expiry, revocation). */
export function VerifyDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("developer");
  const verifyM = useVerifyCredential();
  const [jwt, setJwt] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  useEffect(() => {
    if (!open) return;
    setJwt("");
    setResult(null);
    setFailure(null);
  }, [open]);
  const type = Array.isArray(result?.vc?.type) ? (result.vc.type as unknown[]).at(-1) : undefined;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent title={t("verify.title")} description={t("verify.description")} size="md">
        <DrawerBody>
          <form
            id="verify-drawer"
            className="dev-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!jwt.trim()) return;
              setFailure(null);
              verifyM.mutate(jwt.trim(), { onSuccess: setResult, onError: setFailure });
            }}
          >
            <FormFailure error={failure} />
            <Field label={t("verify.credential")}>
              <Textarea
                className="dev-code-area"
                rows={5}
                value={jwt}
                onChange={(e) => {
                  setJwt(e.target.value);
                  setResult(null);
                }}
                placeholder="eyJhbGciOiJFUzI1NiIs…"
              />
            </Field>
            {result ? (
              <div className="dev-result" role="status">
                <div className="dev-result-head">
                  <Badge tone={result.valid ? "success" : "danger"}>
                    {result.valid ? t("verify.valid") : t("verify.invalid")}
                  </Badge>
                  <span>
                    {result.valid
                      ? t("verify.validWhy")
                      : t(`verify.reason.${reasonKey(result.reason_code)}`)}
                  </span>
                </div>
                {result.subject || result.issuer ? (
                  <DescriptionList>
                    {typeof type === "string" ? (
                      <DescriptionItem term={t("issue.type")}>{type}</DescriptionItem>
                    ) : null}
                    {result.subject ? (
                      <DescriptionItem term={t("issue.subject")}>
                        <code className="dev-code dev-wrap">{result.subject}</code>
                      </DescriptionItem>
                    ) : null}
                    {result.issuer ? (
                      <DescriptionItem term={t("verify.issuer")}>
                        <code className="dev-code dev-wrap">{result.issuer}</code>
                      </DescriptionItem>
                    ) : null}
                  </DescriptionList>
                ) : null}
              </div>
            ) : null}
          </form>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose render={<Button variant="ghost">{t("verify.close")}</Button>} />
          <Button
            type="submit"
            form="verify-drawer"
            icon={FileCheckIcon}
            disabled={!jwt.trim()}
            loading={verifyM.isPending}
          >
            {t("verify.submit")}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
