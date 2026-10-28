import { PlusIcon, ShieldCheckIcon, ShieldIcon, ShieldXIcon } from "@qeetrix/icons";
import { Badge, Button, formatNumber, Switch, Table, type TableColumn, Text } from "@qeetrix/react";
import { DataState, EmptyState, PageContent, PageHeader } from "@qeetrix/react/experimental";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import {
  type AddressRefusal,
  type IpRule,
  useAddressRefusals,
  useDeleteIpRule,
  useEnforcementChange,
  useIpRules,
  useSetIpEnforcement,
} from "@/modules/security/api/ip-allowlist";
import { rangeSize } from "@/modules/security/ip-model";
import { ERROR_CODES } from "@/platform/errors/error-codes";
import { normalizeError } from "@/platform/errors/normalize-error";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { Detail, Failure, Item, Section } from "../security-parts";
import { AddressCheck, AddRule } from "./ip-rules-parts";
import { usePeople } from "../use-people";
import { When } from "../when";
import "../security.css";

/**
 * Security › Threats › IP rules: whether the rules are enforced, a check for an address, the
 * rules (Add rule opens its form under the section's head), and the sign-ins they refused. While
 * enforced, every sign-in and session renewal in the organisation is checked (ipallow.CheckSignIn:
 * password, sign-in link, sign-up, single sign-on, applications' sign-in, device sign-ins and
 * renewals); an address that can't be read is refused.
 */
export function IpRulesPage() {
  const { t } = useTranslation("security");
  const access = useCapabilities();
  const canWrite = access.can("policy.write");
  const list = useIpRules();
  const enabled = list.data?.enabled ?? false;
  const rules = list.data?.items ?? [];

  return (
    <PageTabs>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("ipRules.title")}
        status={
          list.data ? (
            <Badge tone={enabled ? "success" : "neutral"}>
              {enabled ? t("common.on") : t("common.off")}
            </Badge>
          ) : undefined
        }
        description={t("ipRules.description")}
        tabs={<PageTabList />}
      />
      <PageContent width="narrow">
        {list.isError ? (
          <DataState error={list.error} onRetry={() => list.refetch()} />
        ) : (
          <>
            <Enforcement enabled={enabled} rules={rules} loaded={!!list.data} canWrite={canWrite} />
            <Rules enabled={enabled} rules={rules} loaded={!!list.data} canWrite={canWrite} />
            <Refusals rules={rules} />
          </>
        )}
      </PageContent>
    </PageTabs>
  );
}

function Enforcement({
  enabled,
  rules,
  loaded,
  canWrite,
}: {
  enabled: boolean;
  rules: readonly IpRule[];
  loaded: boolean;
  canWrite: boolean;
}) {
  const { t } = useTranslation("security");
  const runSensitive = useSensitiveAction();
  const setEnforcement = useSetIpEnforcement();
  const change = useEnforcementChange();
  const people = usePeople();
  const allow = rules.filter((r) => r.action === "allow").length;
  const deny = rules.length - allow;

  const toggle = (on: boolean) =>
    runSensitive({
      capability: "policy.write",
      confirm: on
        ? {
            title: t("ipRules.enforce.onTitle"),
            description: t("ipRules.enforce.onDescription", {
              allow: formatNumber(allow),
              deny: formatNumber(deny),
            }),
            confirmLabel: t("ipRules.enforce.onConfirm"),
            tone: "destructive",
          }
        : {
            title: t("ipRules.enforce.offTitle"),
            description: t("ipRules.enforce.offDescription"),
            confirmLabel: t("ipRules.enforce.offConfirm"),
            tone: "default",
          },
      actionLabel: t("ipRules.enforce.action"),
      run: () => setEnforcement.mutateAsync(on),
    }).catch(settleSensitiveAction);

  const who = change.data?.actorUserId ? people.get(change.data.actorUserId)?.name : undefined;

  return (
    <Section title={t("ipRules.enforce.title")} description={t("ipRules.enforce.description")}>
      <dl className="account-details">
        <Detail
          label={t("ipRules.enforce.label")}
          hint={
            change.data ? (
              <>
                {who ? t("ipRules.enforce.changedBy", { who }) : t("ipRules.enforce.changed")}{" "}
                <When at={change.data.at} />
              </>
            ) : undefined
          }
          action={
            <Switch
              aria-label={t("ipRules.enforce.label")}
              checked={enabled}
              disabled={!loaded || !canWrite || setEnforcement.isPending}
              onCheckedChange={toggle}
            />
          }
        >
          {enabled ? t("common.on") : t("common.off")}
        </Detail>
        <AddressCheck enabled={enabled} rules={rules} />
      </dl>
      {setEnforcement.error &&
      normalizeError(setEnforcement.error).code === ERROR_CODES.RULES_LOCK_OUT_CALLER ? (
        <Failure>{errorMessage(setEnforcement.error)}</Failure>
      ) : null}
    </Section>
  );
}

/** "256 addresses" for a range, "1 address" for a single one. */
function useSpan() {
  const { t } = useTranslation("security");
  return (cidr: string) => {
    const size = rangeSize(cidr);
    if (size === null) return "";
    if (size > BigInt(Number.MAX_SAFE_INTEGER)) return t("ipRules.rules.manyAddresses");
    return t("ipRules.rules.addresses", { count: Number(size), n: formatNumber(Number(size)) });
  };
}

function Rules({
  enabled,
  rules,
  loaded,
  canWrite,
}: {
  enabled: boolean;
  rules: readonly IpRule[];
  loaded: boolean;
  canWrite: boolean;
}) {
  const { t } = useTranslation("security");
  const runSensitive = useSensitiveAction();
  const remove = useDeleteIpRule();
  const [adding, setAdding] = useState(false);
  const span = useSpan();

  const onRemove = (rule: IpRule) => {
    // What removing it does to people: a deny rule's range can sign in again; an allow rule's,
    // if no other allow rule covers it, is refused (Decide). Off, nothing changes yet.
    const rest = rules.filter((r) => r.id !== rule.id);
    const description = !enabled
      ? t("ipRules.remove.descriptionOff", { cidr: rule.cidr })
      : rule.action === "deny"
        ? t("ipRules.remove.descriptionDeny", { cidr: rule.cidr })
        : rest.some((r) => r.action === "allow")
          ? t("ipRules.remove.descriptionAllow", { cidr: rule.cidr })
          : t("ipRules.remove.descriptionLastAllow", { cidr: rule.cidr });
    runSensitive({
      capability: "policy.write",
      confirm: {
        title: t("ipRules.remove.title", { cidr: rule.cidr }),
        description,
        confirmLabel: t("ipRules.remove.confirm"),
        tone: "destructive",
      },
      actionLabel: t("ipRules.remove.action"),
      run: () => remove.mutateAsync(rule.id),
    }).catch(settleSensitiveAction);
  };

  return (
    <Section
      title={t("ipRules.rules.title")}
      status={loaded ? <Badge size="sm">{formatNumber(rules.length)}</Badge> : undefined}
      description={t("ipRules.rules.description")}
      action={
        canWrite && !adding ? (
          <Button variant="soft" icon={PlusIcon} onClick={() => setAdding(true)}>
            {t("ipRules.rules.add")}
          </Button>
        ) : undefined
      }
    >
      {adding || rules.length ? (
        <ul className="account-rows">
          {adding ? (
            <AddRule enabled={enabled} rules={rules} onDone={() => setAdding(false)} />
          ) : null}
          {rules.map((rule) => (
            <Item
              key={rule.id}
              icon={rule.action === "deny" ? <ShieldXIcon /> : <ShieldCheckIcon />}
              name={<span className="sec-mono">{rule.cidr}</span>}
              badge={<Badge size="sm">{t(`ipRules.effect.${rule.action}`)}</Badge>}
              line={
                <>
                  {[rule.label, span(rule.cidr)].filter(Boolean).join(" · ")} ·{" "}
                  {t("ipRules.rules.added")} <When at={rule.created_at} />
                </>
              }
              actions={
                canWrite ? (
                  <Button
                    variant="ghost"
                    tone="danger"
                    aria-label={t("ipRules.remove.label", { cidr: rule.cidr })}
                    disabled={remove.isPending && remove.variables === rule.id}
                    onClick={() => onRemove(rule)}
                  >
                    {t("ipRules.remove.button")}
                  </Button>
                ) : undefined
              }
            />
          ))}
        </ul>
      ) : loaded ? (
        <EmptyState
          size="section"
          icon={ShieldIcon}
          title={t("ipRules.rules.emptyTitle")}
          description={t("ipRules.rules.emptyDescription")}
        />
      ) : null}
    </Section>
  );
}

function Refusals({ rules }: { rules: readonly IpRule[] }) {
  const { t } = useTranslation("security");
  const refusals = useAddressRefusals();
  const people = usePeople();
  const byId = new Map(rules.map((r) => [r.id, r]));
  const items = refusals.data ?? [];

  const columns: TableColumn<AddressRefusal>[] = [
    {
      id: "person",
      header: t("ipRules.refusals.person"),
      primary: true,
      cell: (r) => {
        const p = r.actorUserId ? people.get(r.actorUserId) : undefined;
        return p ? (
          <span className="sec-two">
            <strong>{p.name}</strong>
            <small>{p.email}</small>
          </span>
        ) : (
          <Text tone="subtle">{t("ipRules.refusals.unknownPerson")}</Text>
        );
      },
    },
    {
      id: "address",
      header: t("ipRules.refusals.address"),
      width: 160,
      cell: (r) =>
        r.address ? <span className="sec-mono">{r.address}</span> : <Text tone="subtle">—</Text>,
    },
    {
      id: "why",
      header: t("ipRules.refusals.why"),
      cell: (r) => {
        if (r.reason === "deny_rule") {
          const rule = r.ruleId ? byId.get(r.ruleId) : undefined;
          return rule
            ? t("ipRules.refusals.byRule", { cidr: rule.cidr })
            : r.cidr
              ? t("ipRules.refusals.byRemovedRule", { cidr: r.cidr })
              : t("ipRules.refusals.byARemovedRule");
        }
        if (r.reason === "address_unknown") return t("ipRules.refusals.unknown");
        return t("ipRules.refusals.notAllowed");
      },
    },
    { id: "when", header: t("ipRules.refusals.when"), width: 136, cell: (r) => <When at={r.at} /> },
  ];

  return (
    <Section
      id="refused"
      title={t("ipRules.refusals.title")}
      status={
        refusals.data ? (
          <Badge size="sm">{formatNumber(items.length, formatLocale())}</Badge>
        ) : undefined
      }
      description={t("ipRules.refusals.description")}
    >
      {refusals.isError ? (
        <DataState error={refusals.error} onRetry={() => refusals.refetch()} />
      ) : (
        <Table<AddressRefusal>
          label={t("ipRules.refusals.title")}
          rows={items}
          rowId={(r) => r.id}
          rowLabel={(r) => `${r.address || "—"}, ${r.at}`}
          columns={columns}
          loading={refusals.isLoading}
          loadingRows={2}
          empty={
            <EmptyState
              size="section"
              icon={ShieldIcon}
              title={t("ipRules.refusals.emptyTitle")}
              description={t("ipRules.refusals.emptyDescription")}
            />
          }
        />
      )}
    </Section>
  );
}
