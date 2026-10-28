import { LinkIcon, RefreshCwIcon, TrashIcon } from "@qeetrix/icons";
import { Badge, Button, TextField } from "@qeetrix/react";
import { Steps } from "@qeetrix/react/experimental";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { type Branding, useBranding } from "@/modules/branding";
import { useSaveSignInAddress } from "@/modules/organizations/api/domain-changes";
import { type LoginDomainStatus, useLoginDomain } from "@/modules/organizations/api/domains";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  SensitiveActionCancelled,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { DnsRecord } from "./dns-record";
import { checkDomain, loginRecords, loginStep } from "./domains-model";
import { Failure, Item, LoadFailed, Loading, Panel, Section } from "./settings-parts";

const STEPS = ["records", "certificate", "live"] as const;

/**
 * The address the organisation's people sign in at: Qeet ID's own, or one of the organisation's
 * (branding's custom_domain). Each read checks it live (GET /login-domain): its two DNS records,
 * then a certificate valid for it, then the hosted sign-in answering on it over HTTPS. Saving it
 * is a branding change, a paid-plan feature.
 */
export function SignInAddress({ name, example }: { name: string; example: string }) {
  const { t } = useTranslation("organizations");
  const access = useCapabilities();
  const canRead = access.can("connection.read");
  const canWrite = access.can("branding.write");
  const statusQ = useLoginDomain(canRead);
  const brandingQ = useBranding(access.can("tenant.read"));
  const [open, setOpen] = useState(false);
  const status = statusQ.data;
  const host = status?.login_domain ?? brandingQ.data?.custom_domain ?? "";

  const badge =
    status?.status === "active" ? (
      <Badge tone="success" size="sm">
        {t("settings.domains.address.status.active")}
      </Badge>
    ) : status?.status === "pending" ? (
      <Badge tone="warning" size="sm">
        {t("settings.domains.address.status.pending")}
      </Badge>
    ) : status ? (
      <Badge tone="neutral" size="sm">
        {t("settings.domains.address.status.none")}
      </Badge>
    ) : undefined;

  return (
    <Section
      title={t("settings.domains.address.title")}
      status={badge}
      description={
        host
          ? t("settings.domains.address.descriptionSet", { name, host })
          : t("settings.domains.address.description", { name, example })
      }
    >
      {!canRead ? (
        <p className="account-note">{t("settings.domains.address.noAccess")}</p>
      ) : statusQ.isError ? (
        <LoadFailed error={statusQ.error} onRetry={() => void statusQ.refetch()} />
      ) : !status ? (
        <Loading rows={1} />
      ) : (
        <ul className="account-rows">
          {open ? (
            <AddressPanel
              status={status}
              branding={brandingQ.data}
              name={name}
              canWrite={canWrite}
              checking={statusQ.isFetching}
              onCheck={() => void statusQ.refetch()}
              onClose={() => setOpen(false)}
            />
          ) : (
            <Item
              icon={<LinkIcon />}
              name={host || t("settings.domains.address.yours")}
              line={t(`settings.domains.address.line.${status.status}`)}
              actions={
                host || canWrite ? (
                  <Button variant="ghost" onClick={() => setOpen(true)}>
                    {host
                      ? t("settings.domains.address.manage")
                      : t("settings.domains.address.setUp")}
                  </Button>
                ) : undefined
              }
            />
          )}
        </ul>
      )}
    </Section>
  );
}

/** The sign-in address, opened: its three steps, the records to publish, and changing it. */
function AddressPanel({
  status,
  branding,
  name,
  canWrite,
  checking,
  onCheck,
  onClose,
}: {
  status: LoginDomainStatus;
  branding?: Branding;
  name: string;
  canWrite: boolean;
  checking: boolean;
  onCheck: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("organizations");
  const runSensitive = useSensitiveAction();
  const save = useSaveSignInAddress();
  const host = status.login_domain;
  const [editing, setEditing] = useState(!host);
  const [draft, setDraft] = useState(host);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const step = host ? loginStep(status) : 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    const next = checkDomain(draft);
    if (!next) return setError(t("settings.domains.address.invalid"));
    if (!branding) return setFailure(t("settings.domains.address.noBranding"));
    if (next === host) return setEditing(false);
    try {
      await save.mutateAsync({ branding, host: next });
      setEditing(false);
    } catch (err) {
      setFailure(errorMessage(err));
    }
  }

  async function removeAddress() {
    if (!branding) return;
    setFailure(null);
    try {
      await runSensitive({
        capability: "branding.write",
        actionLabel: t("settings.domains.address.remove.actionLabel"),
        confirm: {
          title: t("settings.domains.address.remove.title", { host }),
          description: t("settings.domains.address.remove.description", { name, host }),
          confirmLabel: t("settings.domains.address.remove.confirm"),
          tone: "destructive",
        },
        run: () => save.mutateAsync({ branding, host: null }),
      });
      onClose();
    } catch (err) {
      if (!(err instanceof SensitiveActionCancelled)) setFailure(errorMessage(err));
    }
  }

  const steps = STEPS.map((key, index) => ({
    label: t(`settings.domains.address.steps.${key}.label`),
    description:
      index < step
        ? t(`settings.domains.address.steps.${key}.done`, { host })
        : t(`settings.domains.address.steps.${key}.todo`),
  }));

  return (
    <Panel
      as="li"
      title={host || t("settings.domains.address.setUpTitle")}
      description={
        host
          ? t(`settings.domains.address.panel.${status.status}`, { host, name })
          : t("settings.domains.address.panel.new")
      }
    >
      {editing && canWrite ? (
        <form
          id="sign-in-address"
          className="account-panel-form"
          noValidate
          onSubmit={(event) => void submit(event)}
        >
          <TextField
            label={t("settings.domains.address.label")}
            placeholder={t("settings.domains.address.placeholder")}
            description={t("settings.domains.address.hint")}
            autoComplete="off"
            spellCheck={false}
            maxLength={253}
            autoFocus
            value={draft}
            error={error ?? undefined}
            invalid={Boolean(error)}
            disabled={save.isPending}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
          />
        </form>
      ) : null}
      <Steps orientation="vertical" current={step} steps={steps} />
      {host && step === 0 && !editing
        ? loginRecords(status).map((record) => (
            <DnsRecord
              key={record.type}
              type={record.type}
              name={record.name}
              value={record.value}
            />
          ))
        : null}
      {host && step === 0 && !editing ? (
        <p className="account-note">{t("settings.domains.address.recordsNote")}</p>
      ) : null}
      {failure && <Failure>{failure}</Failure>}
      <span className="account-panel-actions settings-panel-actions">
        {editing && canWrite ? (
          <>
            <Button size="lg" type="submit" form="sign-in-address" loading={save.isPending}>
              {t("settings.domains.address.save")}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              disabled={save.isPending}
              onClick={() => {
                if (host) {
                  setEditing(false);
                  setDraft(host);
                  setError(null);
                } else onClose();
              }}
            >
              {t("settings.cancel")}
            </Button>
          </>
        ) : (
          <>
            {step < 3 ? (
              <Button variant="soft" icon={RefreshCwIcon} loading={checking} onClick={onCheck}>
                {t("settings.domains.address.check")}
              </Button>
            ) : null}
            {canWrite ? (
              <Button variant="ghost" onClick={() => setEditing(true)}>
                {t("settings.domains.address.change")}
              </Button>
            ) : null}
            {canWrite ? (
              <Button
                variant="ghost"
                tone="danger"
                icon={TrashIcon}
                loading={save.isPending}
                onClick={() => void removeAddress()}
              >
                {t("settings.domains.address.remove.button")}
              </Button>
            ) : null}
            <span className="settings-spacer" />
            <Button variant="ghost" onClick={onClose}>
              {t("settings.close")}
            </Button>
          </>
        )}
      </span>
    </Panel>
  );
}
