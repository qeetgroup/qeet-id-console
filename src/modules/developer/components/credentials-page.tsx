import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CodeBlock,
  TimeSince,
} from "@qeetrix/ui";
import type { ParseKeys } from "i18next";
import { DataState } from "@/platform/components/data-state";
import { BadgeCheckIcon, CircleCheckIcon, CircleXIcon, TrashIcon } from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { PageHeader } from "@/platform/components/page-header";
import { OneTimeSecret } from "@/shared/components/one-time-secret";
import {
  type IssueResult,
  useCredentials,
  useIssueCredential,
  useRevokeCredential,
  useVerifyCredential,
} from "../api/credentials";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import { useMemo } from "react";
import { z } from "zod";

/** Renders verifiable credentials: issue, verify, and the issued list with revoke. */
export function CredentialsPage() {
  const { t } = useTranslation(["developer", "common"]);
  const runSensitive = useSensitiveAction();
  const listQ = useCredentials();
  const revokeM = useRevokeCredential();

  const [issued, setIssued] = useState<IssueResult | null>(null);

  const items = listQ.data?.items ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader description={t("credentials.description")} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("credentials.issue.title")}</CardTitle>
            <CardDescription>{t("credentials.issue.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <IssueCredentialForm onIssued={setIssued} />
            {issued && (
              <div className="mt-4">
                <OneTimeSecret
                  title={t("credentials.issue.signedLabel")}
                  description={t("credentials.issue.signedOnce")}
                  values={[{ value: issued.jwt }]}
                  dismissLabel={t("common:actions.dismiss")}
                  onDismiss={() => setIssued(null)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <VerifyCard />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("credentials.list.title")}</CardTitle>
          <CardDescription>{t("credentials.list.description")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataState
            isLoading={listQ.isLoading}
            isError={listQ.isError}
            error={listQ.error}
            isEmpty={items.length === 0}
            emptyIcon={BadgeCheckIcon}
            emptyTitle={t("credentials.list.empty")}
            skeletonRows={2}
          >
            <ul className="divide-y">
              {items.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 px-6 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {c.type}
                      {c.revoked && (
                        <Badge variant="destructive">{t("credentials.list.revoked")}</Badge>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.subject} · {t("credentials.list.issued")} <TimeSince value={c.issued_at} />
                      {c.expires_at ? (
                        <>
                          {" "}
                          · {t("credentials.list.expires")} <TimeSince value={c.expires_at} />
                        </>
                      ) : (
                        t("credentials.list.noExpiry")
                      )}
                    </p>
                  </div>
                  {!c.revoked && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={revokeM.isPending}
                      onClick={() =>
                        runSensitive({
                          confirm: {
                            title: t("credentials.confirm.title"),
                            confirmLabel: t("credentials.confirm.label"),
                            tone: "destructive",
                          },
                          actionLabel: t("credentials.stepUp.revoke"),
                          run: () => revokeM.mutateAsync(c.id),
                        }).catch(settleSensitiveAction)
                      }
                    >
                      <TrashIcon /> {t("credentials.list.revokeButton")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </DataState>
        </CardContent>
      </Card>
    </div>
  );
}

// Parses the claims textarea; blank means no claims.
function parseClaims(text: string): Record<string, unknown> | null {
  if (!text.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Renders the form that issues a signed credential; the parent shows the JWT once. */
function IssueCredentialForm({ onIssued }: { onIssued: (result: IssueResult) => void }) {
  const { t } = useTranslation("developer");
  const runSensitive = useSensitiveAction();
  const issueM = useIssueCredential();
  const schema = useMemo(
    () =>
      z.object({
        subject: z.string().trim().min(1, t("credentials.issue.validation.subject")),
        type: z.string().trim().min(1, t("credentials.issue.validation.type")),
        claims: z
          .string()
          .refine((v) => parseClaims(v) !== null, t("credentials.issue.validation.claims")),
        ttl_seconds: z
          .number(t("credentials.issue.validation.ttl"))
          .int(t("credentials.issue.validation.ttl"))
          .min(0, t("credentials.issue.validation.ttl")),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { subject: "", type: "", claims: "{\n  \n}", ttl_seconds: 0 as number | null },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      const body = {
        subject: value.subject.trim(),
        type: value.type.trim(),
        claims: parseClaims(value.claims) ?? {},
        ttl_seconds: value.ttl_seconds ?? 0,
      };
      await runSensitive({
        actionLabel: t("credentials.stepUp.issue"),
        run: () => issueM.mutateAsync(body),
      })
        .then((result) => result && onIssued(result))
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
        });
    },
  });

  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="subject">
        {(field) => (
          <field.TextField
            label={t("credentials.issue.subject")}
            placeholder={t("credentials.issue.subjectPlaceholder")}
            required
          />
        )}
      </form.AppField>
      <form.AppField name="type">
        {(field) => (
          <field.TextField
            label={t("credentials.issue.type")}
            placeholder={t("credentials.issue.typePlaceholder")}
            required
          />
        )}
      </form.AppField>
      <form.AppField name="claims">
        {(field) => (
          <field.TextareaField
            label={t("credentials.issue.claims")}
            rows={4}
            className="font-mono text-xs"
          />
        )}
      </form.AppField>
      <div className="sm:w-40">
        <form.AppField name="ttl_seconds">
          {(field) => <field.NumberField label={t("credentials.issue.ttl")} min={0} />}
        </form.AppField>
      </div>
      <FormError error={issueM.error} />
      <form.AppForm>
        <form.SubmitButton>{t("credentials.issue.submit")}</form.SubmitButton>
      </form.AppForm>
    </form>
  );
}

// The server's verify reason codes, and the sentences a server without them sends instead.
const VERIFY_REASONS: Record<string, ParseKeys<"developer">> = {
  "vc.not_credential": "credentials.verify.reason.notCredential",
  "vc.signature_invalid": "credentials.verify.reason.signature",
  "vc.unknown": "credentials.verify.reason.unknown",
  "vc.revoked": "credentials.verify.reason.revoked",
  "not a verifiable credential": "credentials.verify.reason.notCredential",
  "signature or expiry invalid": "credentials.verify.reason.signature",
  "unknown credential": "credentials.verify.reason.unknown",
  "credential revoked": "credentials.verify.reason.revoked",
};

/** Renders the card that checks a pasted credential's signature, expiry and revocation. */
function VerifyCard() {
  const { t } = useTranslation("developer");
  const verifyM = useVerifyCredential();
  const schema = useMemo(
    () => z.object({ credential: z.string().trim().min(1, t("credentials.verify.validation")) }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { credential: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      await verifyM.mutateAsync(value.credential.trim()).catch(() => undefined);
    },
  });
  const result = verifyM.data;
  const reason = result ? VERIFY_REASONS[result.reason_code ?? result.reason ?? ""] : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("credentials.verify.title")}</CardTitle>
        <CardDescription>{t("credentials.verify.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.AppField name="credential">
            {(field) => (
              <field.TextareaField
                label={t("credentials.verify.credential")}
                rows={4}
                className="font-mono text-xs"
                placeholder="eyJhbGci…"
              />
            )}
          </form.AppField>
          <FormError error={verifyM.error} />
          <form.AppForm>
            <form.SubmitButton variant="outline">
              {t("credentials.verify.submit")}
            </form.SubmitButton>
          </form.AppForm>
        </form>
        {result && (
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              {result.valid ? (
                <>
                  <CircleCheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <Badge variant="success">{t("credentials.badge.valid")}</Badge>
                </>
              ) : (
                <>
                  <CircleXIcon className="text-destructive size-4" />
                  <Badge variant="destructive">{t("credentials.badge.invalid")}</Badge>
                  {reason && <span className="text-muted-foreground">{t(reason)}</span>}
                </>
              )}
            </div>
            {result.valid && result.vc && (
              <CodeBlock language="json" value={JSON.stringify(result.vc, null, 2)} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
