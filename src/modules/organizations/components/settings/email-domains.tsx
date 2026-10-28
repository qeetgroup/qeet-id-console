import { GlobeIcon, PlusIcon, RefreshCwIcon, TrashIcon } from "@qeetrix/icons";
import { Badge, Button, formatDate, TextField } from "@qeetrix/react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import {
  useAddDomain,
  useRemoveDomain,
  useVerifyDomain,
} from "@/modules/organizations/api/domain-changes";
import { type TenantDomain, useDomains } from "@/modules/organizations/api/domains";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  SensitiveActionCancelled,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { DnsRecord } from "./dns-record";
import { checkDomain, checkFailure } from "./domains-model";
import { Failure, Item, LoadFailed, Loading, Panel, Section } from "./settings-parts";

/**
 * The email domains the organisation has proved it owns. What verifying one means is the server's:
 * the organisation that verified a domain manages the accounts on it (and under it) — its single
 * sign-on and directories can create them, no other organisation can — and Qeet ID checks the TXT
 * record only when someone asks. A domain opens under its row, as on My account; adding one opens
 * a form at the end of the list, then the new domain with its record. The per-domain switches the
 * server stores (sso_enabled, jit_enabled, is_default) aren't shown: nothing reads them yet.
 */
export function EmailDomains({ name }: { name: string }) {
  const { t } = useTranslation("organizations");
  const access = useCapabilities();
  const canRead = access.can("connection.read");
  const canWrite = access.can("connection.write");
  const domainsQ = useDomains(canRead);
  const [open, setOpen] = useState<string | "add" | null>(null);
  const items = domainsQ.data?.items ?? [];

  return (
    <Section
      title={t("settings.domains.email.title")}
      description={t("settings.domains.email.description", { name })}
      action={
        canWrite && open !== "add" ? (
          <Button variant="soft" icon={PlusIcon} onClick={() => setOpen("add")}>
            {t("settings.domains.email.add")}
          </Button>
        ) : undefined
      }
    >
      {!canRead ? (
        <p className="account-note">{t("settings.domains.email.noAccess")}</p>
      ) : domainsQ.isError ? (
        <LoadFailed error={domainsQ.error} onRetry={() => void domainsQ.refetch()} />
      ) : domainsQ.isPending ? (
        <Loading rows={1} />
      ) : (
        <ul className="account-rows">
          {items.length === 0 && open !== "add" ? (
            <Item
              icon={<GlobeIcon />}
              name={t("settings.domains.email.none")}
              line={t("settings.domains.email.noneLine", { name })}
            />
          ) : null}
          {items.map((domain) =>
            open === domain.id ? (
              <DomainPanel
                key={domain.id}
                domain={domain}
                name={name}
                canWrite={canWrite}
                onClose={() => setOpen(null)}
              />
            ) : (
              <DomainRow key={domain.id} domain={domain} onOpen={() => setOpen(domain.id)} />
            ),
          )}
          {open === "add" ? (
            <AddDomainPanel
              name={name}
              onCancel={() => setOpen(null)}
              onAdded={(domain) => setOpen(domain.id)}
            />
          ) : null}
        </ul>
      )}
    </Section>
  );
}

function StatusBadge({ domain }: { domain: TenantDomain }) {
  const { t } = useTranslation("organizations");
  if (domain.status === "verified")
    return (
      <Badge tone="success" size="sm">
        {t("settings.domains.status.verified")}
      </Badge>
    );
  if (domain.status === "attention")
    return (
      <Badge tone="warning" size="sm">
        {t("settings.domains.status.attention")}
      </Badge>
    );
  return (
    <Badge tone="neutral" size="sm">
      {t("settings.domains.status.pending")}
    </Badge>
  );
}

/** One domain, closed: its state in a word and a line, and Manage. */
function DomainRow({ domain, onOpen }: { domain: TenantDomain; onOpen: () => void }) {
  const { t } = useTranslation("organizations");
  const locale = formatLocale();
  const line =
    domain.status === "verified" && domain.verified_at
      ? t("settings.domains.row.verified", {
          date: formatDate(domain.verified_at, locale, { dateStyle: "medium" }),
        })
      : domain.status === "attention"
        ? t(`settings.domains.failure.${checkFailure(domain.last_error)}`)
        : t("settings.domains.row.pending");
  return (
    <Item
      icon={<GlobeIcon />}
      name={domain.domain}
      badge={<StatusBadge domain={domain} />}
      line={line}
      actions={
        <Button
          variant="ghost"
          aria-label={t("settings.domains.row.manageLabel", { domain: domain.domain })}
          onClick={onOpen}
        >
          {t("settings.domains.row.manage")}
        </Button>
      }
    />
  );
}

/** A domain, opened: what its state means, its TXT record, and checking or removing it. */
function DomainPanel({
  domain,
  name,
  canWrite,
  onClose,
}: {
  domain: TenantDomain;
  name: string;
  canWrite: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation("organizations");
  const locale = formatLocale();
  const runSensitive = useSensitiveAction();
  const verify = useVerifyDomain();
  const remove = useRemoveDomain();
  const [failure, setFailure] = useState<string | null>(null);
  const verified = domain.status === "verified";
  const date = (value?: string | null) =>
    value ? formatDate(value, locale, { dateStyle: "medium" }) : "";

  const description = verified
    ? t("settings.domains.panel.verified", {
        date: date(domain.verified_at),
        name,
        domain: domain.domain,
      })
    : domain.status === "attention"
      ? t("settings.domains.panel.attention", {
          date: date(domain.last_checked_at),
          reason: t(`settings.domains.failure.${checkFailure(domain.last_error)}`),
        })
      : t("settings.domains.panel.pending");

  async function check() {
    setFailure(null);
    try {
      await verify.mutateAsync(domain.id);
    } catch (err) {
      setFailure(errorMessage(err));
    }
  }

  async function removeDomain() {
    setFailure(null);
    try {
      await runSensitive({
        capability: "connection.write",
        actionLabel: t("settings.domains.remove.actionLabel"),
        confirm: {
          title: t("settings.domains.remove.title", { domain: domain.domain }),
          description: verified
            ? t("settings.domains.remove.descriptionVerified", { name, domain: domain.domain })
            : t("settings.domains.remove.descriptionPending", { domain: domain.domain }),
          confirmLabel: t("settings.domains.remove.confirm"),
          tone: "destructive",
        },
        run: () => remove.mutateAsync(domain.id),
      });
      onClose();
    } catch (err) {
      if (!(err instanceof SensitiveActionCancelled)) setFailure(errorMessage(err));
    }
  }

  return (
    <Panel as="li" title={domain.domain} description={description}>
      <DnsRecord
        type={domain.dns_record_type}
        name={domain.dns_record_name}
        value={domain.dns_record_value}
        note={
          verified
            ? t("settings.domains.panel.recordVerified")
            : t("settings.domains.panel.recordPending", { domain: domain.domain })
        }
      />
      {failure && <Failure>{failure}</Failure>}
      <span className="account-panel-actions settings-panel-actions">
        {canWrite && !verified ? (
          <Button icon={RefreshCwIcon} loading={verify.isPending} onClick={() => void check()}>
            {t("settings.domains.panel.check")}
          </Button>
        ) : null}
        {canWrite ? (
          <Button
            variant="ghost"
            tone="danger"
            icon={TrashIcon}
            loading={remove.isPending}
            onClick={() => void removeDomain()}
          >
            {t("settings.domains.panel.remove")}
          </Button>
        ) : null}
        <span className="settings-spacer" />
        <Button variant="ghost" onClick={onClose}>
          {t("settings.close")}
        </Button>
      </span>
    </Panel>
  );
}

/** Adding a domain: its name, checked as the server will, then the domain opens with its record. */
function AddDomainPanel({
  name,
  onCancel,
  onAdded,
}: {
  name: string;
  onCancel: () => void;
  onAdded: (domain: TenantDomain) => void;
}) {
  const { t } = useTranslation("organizations");
  const runSensitive = useSensitiveAction();
  const add = useAddDomain();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    const domain = checkDomain(draft);
    if (!domain) return setError(t("settings.domains.add.invalid"));
    try {
      const added = await runSensitive({
        capability: "connection.write",
        actionLabel: t("settings.domains.add.actionLabel"),
        run: () => add.mutateAsync(domain),
      });
      if (added) onAdded(added);
    } catch (err) {
      if (!(err instanceof SensitiveActionCancelled)) setFailure(errorMessage(err));
    }
  }

  return (
    <Panel
      as="li"
      title={t("settings.domains.add.title")}
      description={t("settings.domains.add.description", { name })}
    >
      <form className="account-panel-form" noValidate onSubmit={(event) => void submit(event)}>
        <TextField
          label={t("settings.domains.add.label")}
          placeholder={t("settings.domains.add.placeholder")}
          description={t("settings.domains.add.hint")}
          autoComplete="off"
          spellCheck={false}
          maxLength={253}
          autoFocus
          value={draft}
          error={error ?? undefined}
          invalid={Boolean(error)}
          disabled={add.isPending}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
        />
        {failure && <Failure>{failure}</Failure>}
        <span className="account-panel-actions">
          <Button size="lg" type="submit" loading={add.isPending}>
            {t("settings.domains.add.submit")}
          </Button>
          <Button variant="ghost" size="lg" disabled={add.isPending} onClick={onCancel}>
            {t("settings.cancel")}
          </Button>
        </span>
      </form>
    </Panel>
  );
}
