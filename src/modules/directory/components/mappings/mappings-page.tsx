import { ArrowRightIcon, ChevronDownIcon, EyeIcon, NetworkIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
  Skeleton,
} from "@qeetrix/react";
import { Alert, DataState, EmptyState, PageContent, PageHeader } from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { useLdapConnections } from "@/modules/authentication";
import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import {
  DEFAULT_ERROR_FILTERS,
  useDirectoryConnections,
  useDirectoryErrors,
} from "@/modules/directory/api/directory";
import { useDirectoryMappings } from "@/modules/directory/api/mappings";
import { healthState } from "@/modules/directory/connections-model";
import type { DirectoryConnection } from "@/modules/directory/directory-model";
import {
  fieldMappings,
  type LdapAttributes,
  TARGETS,
  type Target,
} from "@/modules/directory/mappings-model";
import type { MappingsFilters } from "@/modules/directory/sync-search";
import { useCapabilities } from "@/platform/security/capability-provider";
import { connectionPage } from "../connections/connections-table";
import { FieldEditor, FieldRow } from "./mapping-fields";
import { Detail, Section } from "./mapping-parts";
import { MappingTest } from "./mapping-test";
import "./mappings.css";

const NO_CONNECTIONS: DirectoryConnection[] = [];

export type MappingsPageProps = {
  /** The connection in the address; the first one without it. */
  filters: MappingsFilters;
  onFiltersChange: (next: MappingsFilters) => void;
};

/**
 * Directory › Directories › Mappings, a Settings page for one connection at a time: which
 * directory attribute fills each Qeet ID field, one ruled row a field, mapped in place; with no
 * mapping, the email and name come from the connection's own settings (LDAP) or what the identity
 * provider sends (SCIM). Then a test with one directory entry: the profile it makes.
 */
export function MappingsPage({ filters, onFiltersChange }: MappingsPageProps) {
  const { t } = useTranslation("directory");
  const canWrite = useCapabilities().can("connection.write");
  const connectionsQ = useDirectoryConnections();
  const connections = connectionsQ.data ?? NO_CONNECTIONS;
  const connection = connections.find((c) => c.id === filters.connection) ?? connections[0];
  const openQ = useDirectoryErrors({
    ...DEFAULT_ERROR_FILTERS,
    days: 90,
    resolution: "open",
    limit: 100,
  });

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("mappings.title")}
        description={t("mappings.description")}
        tabs={
          <PageTabs>
            <PageTabList badges={{ "/directory/sync-errors": openQ.data?.summary.open }} />
          </PageTabs>
        }
      />
      <PageContent width="narrow">
        <div className="map">
          {!canWrite && connections.length ? (
            <Alert tone="info" icon={EyeIcon} title={t("mappings.readOnly.title")}>
              {t("mappings.readOnly.description")}
            </Alert>
          ) : null}
          {connectionsQ.isError ? (
            <DataState error={connectionsQ.error} onRetry={() => connectionsQ.refetch()} />
          ) : connectionsQ.isLoading ? (
            <Skeleton lines={6} />
          ) : !connection ? (
            <EmptyState
              size="section"
              icon={NetworkIcon}
              title={t("mappings.none.title")}
              description={t("mappings.none.description")}
              actions={
                <Button
                  variant="soft"
                  icon={ArrowRightIcon}
                  render={<Link to="/directory/connections" />}
                >
                  {t("mappings.none.action")}
                </Button>
              }
            />
          ) : (
            <ConnectionMappings
              // A connection's own editor and test: switching starts both afresh.
              key={connection.id}
              connection={connection}
              connections={connections}
              canWrite={canWrite}
              onSwitch={(id) => onFiltersChange({ connection: id })}
            />
          )}
        </div>
      </PageContent>
    </>
  );
}

function ConnectionMappings({
  connection: c,
  connections,
  canWrite,
  onSwitch,
}: {
  connection: DirectoryConnection;
  connections: readonly DirectoryConnection[];
  canWrite: boolean;
  onSwitch: (id: string) => void;
}) {
  const { t } = useTranslation("directory");
  const kind = c.type;
  const ldapQ = useLdapConnections(kind === "ldap");
  const ldap = kind === "ldap" ? ldapQ.data?.items.find((l) => l.id === c.id) : undefined;
  const attributes: LdapAttributes | undefined = ldap
    ? { email_attribute: ldap.email_attribute, name_attribute: ldap.name_attribute }
    : undefined;
  const mappingsQ = useDirectoryMappings(c.id);
  const [editing, setEditing] = useState<Target | null>(null);
  const mappings = mappingsQ.data?.items ?? [];
  const byField = fieldMappings(mappings);
  const name = kind === "scim" ? t("connections.kinds.scim") : c.name;
  const nameOf = (x: DirectoryConnection) =>
    x.type === "scim" ? t("connections.kinds.scim") : x.name;

  const statusHint =
    c.status === "draft"
      ? t("mappings.connection.draft")
      : c.status === "disabled"
        ? t("mappings.connection.disabled")
        : kind === "ldap"
          ? t("mappings.connection.ldapOn")
          : t("mappings.connection.scimOn");

  return (
    <>
      <Section title={t("mappings.connection.title")}>
        <dl className="account-details">
          <Detail
            label={t("mappings.connection.for")}
            hint={
              kind === "scim" ? (
                t("mappings.connection.scimHint")
              ) : ldap?.base_dn ? (
                <Trans
                  t={t}
                  i18nKey="mappings.connection.ldapHint"
                  values={{ baseDn: ldap.base_dn }}
                  components={{ code: <code /> }}
                />
              ) : (
                t("mappings.connection.ldapHintNoDn")
              )
            }
            action={
              connections.length > 1 ? (
                // A picker that stays open after a choice is QTRX-42; this one closes on its own.
                <Menu>
                  <MenuTrigger
                    render={
                      <Button variant="ghost" size="sm" icon={ChevronDownIcon}>
                        {t("mappings.connection.switch")}
                      </Button>
                    }
                  />
                  <MenuContent align="end">
                    <MenuRadioGroup value={c.id} onValueChange={(id) => onSwitch(String(id))}>
                      {connections.map((x) => (
                        <MenuRadioItem key={x.id} value={x.id} closeOnClick>
                          {nameOf(x)}
                        </MenuRadioItem>
                      ))}
                    </MenuRadioGroup>
                  </MenuContent>
                </Menu>
              ) : undefined
            }
          >
            {name}
          </Detail>
          <Detail
            label={t("mappings.connection.status")}
            hint={
              healthState(c) === "failing"
                ? `${t("mappings.connection.failing")} ${statusHint}`
                : statusHint
            }
            action={
              <Button variant="ghost" size="sm" render={<Link to={connectionPage(c)} />}>
                {t("mappings.connection.open")}
              </Button>
            }
          >
            {c.status === "draft" ? (
              <Badge size="sm">{t("connections.status.draft")}</Badge>
            ) : c.status === "disabled" ? (
              <Badge size="sm">{t("connections.status.off")}</Badge>
            ) : (
              <Badge size="sm" tone="success">
                {t("connections.status.on")}
              </Badge>
            )}
          </Detail>
        </dl>
      </Section>

      <Section
        title={t("mappings.fields.title")}
        description={
          kind === "ldap"
            ? t("mappings.fields.descriptionLdap")
            : t("mappings.fields.descriptionScim")
        }
      >
        {mappingsQ.isError ? (
          <DataState error={mappingsQ.error} onRetry={() => mappingsQ.refetch()} />
        ) : mappingsQ.isLoading || (kind === "ldap" && ldapQ.isLoading) ? (
          <Skeleton lines={8} />
        ) : (
          <dl className="account-details">
            {TARGETS.map((target) =>
              editing === target && canWrite ? (
                <FieldEditor
                  key={target}
                  target={target}
                  mapping={byField.get(target)}
                  kind={kind}
                  connectionId={c.id}
                  valueType={
                    mappingsQ.data?.targets[target] ?? (target === "groups" ? "array" : "string")
                  }
                  count={mappings.length}
                  onClose={() => setEditing(null)}
                />
              ) : (
                <FieldRow
                  key={target}
                  target={target}
                  mapping={byField.get(target)}
                  kind={kind}
                  ldap={attributes}
                  canWrite={canWrite}
                  onEdit={() => setEditing(target)}
                />
              ),
            )}
          </dl>
        )}
      </Section>

      <MappingTest connectionId={c.id} kind={kind} ldap={attributes} mappings={mappings} />
    </>
  );
}
