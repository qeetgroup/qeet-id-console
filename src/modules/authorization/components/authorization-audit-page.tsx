import {
  Badge,
  Button,
  Card,
  CardContent,
  Combobox,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { DataState } from "@/platform/components/data-state";
import { RefreshCwIcon, ScrollTextIcon } from "@qeetrix/icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";
import {
  AUTHZ_RESOURCE_TYPES,
  isAuthzEvent,
  RESOURCE_TYPE_LABELS,
  resourceTypeKey,
  useAuditEvents,
} from "../api/audit";

/** Renders the authorization audit trail with its filters. */
export function AuthorizationAuditPage() {
  const { t, i18n } = useTranslation("authorization");
  const [resourceType, setResourceType] = useState("");
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const auditQ = useAuditEvents({ resource_type: resourceType, action, q, limit: 200 });
  const resourceItems = useMemo(
    () => [
      { label: t("authorizationAuditPage.allResources"), value: "" },
      ...AUTHZ_RESOURCE_TYPES.map((r) => ({ label: i18n.t(RESOURCE_TYPE_LABELS[r]), value: r })),
    ],
    [t, i18n],
  );

  // When no specific resource type is chosen, keep the view to authz events only.
  const items = (auditQ.data?.items ?? []).filter((e) => (resourceType ? true : isAuthzEvent(e)));

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        description={t("authorizationAuditPage.everyAuthorizationChangeIs")}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => auditQ.refetch()}
            disabled={auditQ.isFetching}
          >
            <RefreshCwIcon className={auditQ.isFetching ? "animate-spin" : ""} />{" "}
            {t("roles.refreshBtn")}
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="w-56">
            <Combobox
              items={resourceItems}
              value={resourceType}
              onValueChange={(v) => setResourceType(v ?? "")}
              placeholder={t("authorizationAuditPage.resourceType")}
            />
          </div>
          <Input
            className="w-52"
            placeholder={t("authorizationAuditPage.filterByAction")}
            value={action}
            onChange={(e) => setAction(e.target.value)}
            aria-label={t("authorizationAuditPage.actionFilter")}
          />
          <Input
            className="w-52"
            placeholder={t("authorizationAuditPage.search")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label={t("authorizationAuditPage.searchAudit")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <DataState
            isLoading={auditQ.isLoading}
            isError={auditQ.isError}
            error={auditQ.error}
            isEmpty={items.length === 0}
            emptyIcon={ScrollTextIcon}
            emptyTitle={t("authorizationAuditPage.noAuthorizationEvents")}
            skeletonRows={6}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("authorizationAuditPage.when")}</TableHead>
                  <TableHead>{t("authorizationAuditPage.action")}</TableHead>
                  <TableHead>{t("authorizationAuditPage.resource")}</TableHead>
                  <TableHead>{t("authorizationAuditPage.actor")}</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((e) => {
                  const typeKey = resourceTypeKey(e.resource_type);
                  return (
                    <TableRow key={e.id}>
                      <TableCell>
                        <TimeSince value={e.created_at} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{e.action}</TableCell>
                      <TableCell>
                        <Badge variant="muted">{typeKey ? i18n.t(typeKey) : e.resource_type}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {e.actor_user_id ? e.actor_user_id.slice(0, 8) : e.actor_type}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {e.ip ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </DataState>
        </CardContent>
      </Card>
    </div>
  );
}
